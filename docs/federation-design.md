# Federation Design: ActivityPub Spike

Status: **research spike** — no implementation commitment  
Author: Research spike for v0.2 backlog  
Date: 2026-05-20

---

## 1. What federation means for Earthropy

ActivityPub is the W3C protocol that connects the fediverse: Mastodon, Lemmy, Pixelfed, BookWyrm, PeerTube, and others. An Earthropy instance that implements ActivityPub becomes a peer on that network.

In concrete terms:

- **Groups as actors.** A group like `sdg13-climate-action` on `earthropy.org` would have a stable URI — `https://earthropy.org/groups/sdg13-climate-action` — that a Mastodon user could follow. Published posts from that group would appear in that user's Mastodon timeline.
- **Posts as Notes/Articles.** Each published post becomes an `Article` object (or `Note` for short-form). When the group receives a `Follow`, it fans the post out to followers' inboxes.
- **Comments from remote users.** A Mastodon user replying to a boosted post would send a `Create(Note)` activity to the group's inbox. That comment arrives as federated content that needs to pass through the local moderation pipeline before appearing.
- **Multi-instance Earthropy.** Two self-hosted Earthropy instances could federate with each other: groups on one instance could have followers on another. SDG-focused content would propagate across the network without each community needing to coordinate through a central server.

Federation is a strong fit for Earthropy's mission — the SDGs are a global frame and the communities working on them are globally distributed. Concentrating all of that community on a single instance creates a single point of failure and a single point of governance. Federation dissolves that concentration.

That said, the protocol is complex enough to warrant honest scoping before any implementation begins.

---

## 2. Schema impact analysis

The current schema was designed for a single-instance deployment. Every FK in every table assumes the referenced row exists locally. Federation requires bridging to remote objects that live outside the database.

### 2.1 Tables that need new columns

**`users`**

The `handle` column is currently a bare string (`arnirjhor`). Federated identities need a domain component. A local user's fediverse handle would be `@arnirjhor@earthropy.org`; a remote user who commented from Mastodon is `@someone@mastodon.social`.

```sql
-- additions to users
ap_id          text UNIQUE,        -- canonical actor URI, e.g. https://earthropy.org/users/arnirjhor
ap_public_key  text,               -- PEM-encoded RSA public key for HTTP signature verification
remote         boolean NOT NULL DEFAULT false,
-- for remote users only:
remote_inbox   text,               -- https://mastodon.social/users/someone/inbox
remote_shared_inbox text,          -- https://mastodon.social/inbox (shared inbox optimisation)
remote_fetched_at timestamptz,     -- last time the actor document was fetched / refreshed
```

Local users get an `ap_id` minted from the instance domain; remote users get an `ap_id` that is their home-instance URI. The unique constraint on `ap_id` makes deduplication safe.

**`groups`**

Groups are the primary actor type for Earthropy federation — the equivalent of Lemmy communities. Each group needs its own actor identity.

```sql
-- additions to groups
ap_id          text UNIQUE,        -- https://earthropy.org/groups/sdg13-climate-action
ap_public_key  text,               -- RSA public key (group signs outgoing activities)
ap_private_key text,               -- RSA private key (stored encrypted at rest)
remote         boolean NOT NULL DEFAULT false,
-- for remote groups (if we federate group-to-group):
remote_inbox   text,
remote_fetched_at timestamptz,
```

The private key is sensitive. In practice it should be stored in an encrypted vault (environment variable or secret manager, not in the database column) and the column would hold a reference. The exact mechanism depends on the self-host story; for v0.1-style Docker deployments an env var per group is impractical, so a `secrets` table or a KMS-backed column is likely needed. This is a non-trivial ops decision.

**`posts`**

```sql
-- additions to posts
ap_id          text UNIQUE,        -- https://earthropy.org/posts/<uuid>
remote         boolean NOT NULL DEFAULT false,
remote_url     text,               -- original post URL on remote instance (for linking back)
```

**`comments`**

```sql
-- additions to comments
ap_id          text UNIQUE,
remote         boolean NOT NULL DEFAULT false,
remote_url     text,
-- ActivityPub inReplyTo is richer than our parentCommentId (which can reference a post too)
ap_in_reply_to text,               -- the ap_id of the object this is a reply to
```

### 2.2 New tables needed

**`remote_actors`** — a cache of fetched actor documents (users or groups on other instances)

```sql
CREATE TABLE remote_actors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ap_id        text NOT NULL UNIQUE,   -- canonical URI
  type         text NOT NULL,          -- 'Person' | 'Group' | 'Service' | ...
  inbox        text NOT NULL,
  shared_inbox text,
  public_key   text,                   -- PEM; used to verify incoming HTTP signatures
  actor_json   jsonb NOT NULL,         -- raw cached actor document
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

This table is a local cache. The authoritative source is always the remote instance. Entries expire and must be re-fetched.

**`federation_inbox`** — raw inbound activities before processing

```sql
CREATE TABLE federation_inbox (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_ap_id text NOT NULL,           -- who sent it
  activity    jsonb NOT NULL,          -- raw Activity (Create, Follow, Undo, Delete, ...)
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error       text                     -- null if clean; error message if processing failed
);
```

Persisting the raw inbox is important for auditability and retry. A BullMQ worker processes entries asynchronously; the raw row survives even if processing fails.

**`federation_outbox`** — activities to deliver to remote inboxes

```sql
CREATE TABLE federation_outbox (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity     jsonb NOT NULL,          -- serialized Activity
  target_inbox text NOT NULL,           -- URL to POST to
  attempts     integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  succeeded_at timestamptz,
  failed_at    timestamptz,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

This is essentially a delivery queue. A BullMQ worker picks up rows and attempts delivery. Retry with exponential backoff. The ActivityPub spec requires delivery to succeed eventually (or the sender must send `Tombstone` on permanent failure).

**`group_followers`** — tracks who (or what) is following a local group

```sql
CREATE TABLE group_followers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  actor_ap_id  text NOT NULL,           -- the follower's canonical URI
  accepted_at  timestamptz,             -- null until the group sends Accept
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, actor_ap_id)
);
```

A follower can be a local user (their `users.ap_id`) or a remote actor (their remote URI). When the group publishes a post, it fans out to all accepted followers' inboxes.

### 2.3 Impact on the moderation pipeline

This is the most consequential design question.

**Inbound content from remote users must be moderated.** A comment arriving from Mastodon is user-generated content. The moderation promise in `docs/moderation-policy.md` is about what gets published on Earthropy, not where it originated. There is no practical reason to exempt remote content; if anything, remote content is higher-risk because Earthropy has no reputation history on the author.

Current flow: local user submits → content enters `pending_ai` → BullMQ job → AI classification → `moderation_decisions` row → status update.

Federated inbound flow: remote actor's `Create(Note)` arrives at the group inbox → `federation_inbox` row → inbox processing worker → content row inserted with `status='pending_ai'` and `remote=true` → standard moderation job enqueued → same pipeline.

The moderation pipeline itself does not need to change. The `moderationTarget` enum already covers `post` and `comment`; the target just happens to be authored by a remote actor. The `authorId` FK on `posts` and `comments` would point to a row in `users` created from the `remote_actors` cache (a synthetic local user record for the remote actor, with `remote=true`).

One policy question: does reputation affect moderation thresholds for remote users? Remote users have no local reputation history. The current system passes `authorReputation` as a soft prior to the AI. For remote users the initial reputation would be `0`. This is conservative — the AI applies the same threshold as a brand-new local user.

**Moderation of Announce activities.** When a remote instance re-announces (boosts) a post, no new content is created. The `Announce` simply expands distribution. No moderation action is needed, but the platform should track that an external instance is amplifying its content (useful for transparency stats).

**Moderation decisions on remote content are local.** If Earthropy rejects a comment from a Mastodon user, the rejection is local: the comment does not appear on Earthropy. It may still appear on Mastodon. There is no inter-instance moderation protocol in ActivityPub. The `moderation_decisions` immutability rule still applies.

### 2.4 Impact on the reputation system

**Reputation is instance-local.** A user with high reputation on `earthropy.social` has reputation `0` when they first appear on `earthropy.org`. This is consistent with how Mastodon handles inter-instance trust: it does not cross-carry.

**Remote users cannot accumulate local reputation** without some explicit bridging mechanism. For MVP federation this is the correct behavior: remote users are guests. Their content is moderated at the same threshold as new local users; there is no path for them to become moderators or admins on a foreign instance.

**Potential v0.3+ extension.** An inter-instance reputation vouching mechanism (an `Endorsement` activity type, used by some fediverse software) could allow an instance to say "this actor has reputation X on our instance." This is speculative and out of scope for any near-term version.

---

## 3. Identity model changes

### 3.1 Current model

A user is a UUID primary key with a bare `handle` and an `email`. There is no concept of a domain component. The handle `arnirjhor` is globally unique within one instance.

### 3.2 ActivityPub identity

In ActivityPub, every actor has a canonical URI (`ap_id`) that globally identifies them. For a local user `arnirjhor` on `earthropy.org`, that URI is `https://earthropy.org/users/arnirjhor`. This URI is the stable identity that other instances use for Follow, mention, and attribution.

**WebFinger** is the discovery layer: when another instance wants to find the actor document for `@arnirjhor@earthropy.org`, it issues a `GET https://earthropy.org/.well-known/webfinger?resource=acct:arnirjhor@earthropy.org`. This returns a JRD (JSON Resource Descriptor) pointing to the actor URI. Earthropy needs a WebFinger endpoint, which is a simple read-only route over local user and group data.

**HTTP Signatures** are the server-to-server auth mechanism. When Earthropy delivers an activity to a remote inbox, it signs the HTTP request using the sender's private key. The receiving server fetches the actor document to get the public key and verifies the signature. This prevents spoofing. Every local actor (user, group) needs an RSA key pair; the private key must be stored securely and never exposed in the actor document.

### 3.3 Bridging local users

Local users already have `handle`. Adding `ap_id` as `https://<instance-domain>/users/<handle>` is straightforward. The handle uniqueness constraint (`users_handle_lower_uq`) must remain because the fediverse address is `@<handle>@<domain>`.

**Handle collisions across instances are by design not a problem.** `arnirjhor@earthropy.org` and `arnirjhor@mastodon.social` are different identities. The `ap_id` (full URI) is the canonical deduplication key, not the bare handle.

### 3.4 Remote users

When a remote actor sends an activity (Follow, Create, etc.), the instance must look up or create a local representation. The recommended pattern:

1. Check `remote_actors` for the `actor_ap_id`.
2. If not present, fetch the actor document from the AP URI.
3. Cache it in `remote_actors`.
4. Optionally create a row in `users` with `remote=true` and `ap_id` set to the remote URI. This synthetic user row is what FKs in `posts` and `comments` point to.

Remote users should not have `email` or `passwordHash`. They cannot log in locally. They cannot receive local notifications. They cannot file appeals (they have no local identity to attach an appeal to — though this is a policy decision, not a protocol requirement). They can have their content published, held, or rejected by the local moderation pipeline.

**Can remote users join groups?** A remote actor can send a `Follow` to a group (making them a follower who receives posts) but joining as a `groupMembers` member with `member_role` is a local concept. For MVP, remote actors are followers, not members. Moderator and owner roles would be local-only.

---

## 4. Protocol complexity assessment

This section is an honest accounting of what implementing ActivityPub entails. The protocol surface is larger than it first appears.

### 4.1 Core activities

| Activity | Direction | Required for | Notes |
|---|---|---|---|
| `Follow` | Inbound | Remote actors following groups | Responds with `Accept` or `Reject` |
| `Accept(Follow)` | Outbound | Confirming a Follow | Gated on group visibility settings |
| `Reject(Follow)` | Outbound | Rejecting a Follow | For private groups |
| `Undo(Follow)` | Inbound | Remote actors unfollowing | Must remove from `group_followers` |
| `Create(Note/Article)` | Both | Posts/comments | Inbound needs moderation; outbound is fanout |
| `Update(Note/Article)` | Both | Editing posts/comments | Earthropy currently has no edit flow |
| `Delete(Note/Article)` | Both | Deleting posts/comments | Inbound deletes must update local content status |
| `Announce` | Both | Boosting/sharing | Outbound: posts boost; inbound: tracking |
| `Like` | Inbound | Reactions from fediverse | Earthropy has no reaction system in v0.1 |
| `Undo(Announce)`, `Undo(Like)` | Inbound | Removing reactions/boosts | Consistency |

The minimum viable read-only federation (groups are followable, posts appear in timelines, no inbound interaction) requires only: `Follow` (inbound), `Accept(Follow)` (outbound), `Undo(Follow)` (inbound), and `Create(Article)` (outbound). That is a much smaller surface.

### 4.2 HTTP endpoints

Each actor (user and group) needs:

- `GET /users/<handle>` and `GET /groups/<slug>` — actor document (JSON-LD, `application/activity+json`)
- `POST /users/<handle>/inbox` and `POST /groups/<slug>/inbox` — receive activities
- `GET /users/<handle>/outbox` and `GET /groups/<slug>/outbox` — paginated collection of activities (required by spec)
- `GET /users/<handle>/followers` and `/following` — collections (required by spec for some implementations)
- `GET /.well-known/webfinger` — discovery

That is roughly 10–12 new routes in `apps/api`.

### 4.3 JSON-LD serialization

ActivityPub is built on JSON-LD. Every object needs a `@context` field. Most implementations use the standard ActivityStreams 2.0 context (`https://www.w3.org/ns/activitystreams`) plus optional extensions. In practice:

- You do not need a full JSON-LD processor.
- Most fediverse software sends and receives a "compacted" form with `@context` and key names following the ActivityStreams vocabulary. You can hard-code the context for outbound activities.
- For inbound activities you need to handle the `@context` gracefully — some software includes extensions, others use aliases. A lenient parser that knows the AS2 vocabulary is sufficient for compatibility with major fediverse software (Mastodon, Lemmy, Pixelfed).

The `@fedify/fedify` library (Apache 2.0) handles this layer. It provides actor, activity, and object classes with JSON-LD serialization/deserialization and handles the context complexity. See Section 6.

### 4.4 HTTP Signatures

Every outbound activity delivery must be signed. The spec (and the Mastodon implementation specifically) uses the `draft-cavage-http-signatures` scheme, not the newer `RFC 9421` — this is a historical wart in the fediverse that every new implementation has to navigate.

The signature covers: the `(request-target)`, `host`, `date`, and `digest` (SHA-256 of the body) headers. Verification on inbound activities requires fetching the sender's actor document to get their public key, which involves an HTTP request to an external server. This must be cached aggressively to avoid being a DDoS amplifier.

HTTP signatures are the single largest correctness risk in a federation implementation. Subtle bugs (wrong header order, digest mismatch, clock skew rejection) silently break federation with specific instances and are hard to debug.

### 4.5 Delivery semantics

ActivityPub requires best-effort delivery with retries. The outbound delivery model maps naturally to BullMQ:

- Worker dequeues from `federation_outbox`.
- POST to target inbox.
- On 2xx: mark succeeded.
- On 4xx (except 429): permanent failure; mark failed; do not retry.
- On 5xx or network error: retry with exponential backoff up to a configurable limit.
- On 429: honor `Retry-After`.

The shared-inbox optimization (delivering once to `https://mastodon.social/inbox` instead of once per follower on `mastodon.social`) is important for instances with many followers on the same remote domain. It requires grouping outbox entries by shared inbox domain.

### 4.6 Content addressing and deduplication

The `ap_id` URI is the global deduplication key. If two delivery paths produce the same activity (e.g., a relay re-delivers a `Create`), the receiving instance must detect the duplicate via the `id` field and skip processing. The `ap_id UNIQUE` constraint on `posts` and `comments` handles this.

### 4.7 Security surface

Federation expands the attack surface considerably:

- **Inbox flooding.** A malicious instance can POST arbitrary activities to any inbox. All inbound activities should be rate-limited by origin IP and by `actor_ap_id`. The `federation_inbox` table provides the record; rate limiting is applied at the HTTP layer (BullMQ processing can also shed load).
- **Spoofed actors.** Without HTTP signature verification, any server can claim to be `@someone@mastodon.social`. Signature verification is mandatory, not optional.
- **Tombstone handling.** When a `Delete` activity arrives for content Earthropy holds in `pending_ai`, the correct behavior is to mark it as withdrawn, not delete it (preserving the moderation audit trail).
- **Instance blocking.** The platform needs the ability to block an entire instance's actors (defederation). This requires a `blocked_domains` table and checks at inbox ingestion time. Omitting this makes the moderation team's job much harder in practice.
- **SSRF via actor fetch.** When fetching a remote actor document, the HTTP client must not be tricked into fetching internal services (e.g., `http://localhost:5432`). An allow-list of URL schemes and a check against RFC 1918 ranges is required.

---

## 5. Recommendation

### 5.1 Federation levels and effort

**Level 0 — None (status quo):** 0 effort. No fediverse presence. Instances are isolated.

**Level 1 — Read-only outbound:** Groups and posts are discoverable and followable from the fediverse. Remote users receive posts in their timelines. No inbound interaction is processed (inbound activities are ignored or rejected).

This requires: actor endpoints, WebFinger, HTTP signatures for delivery, `Follow`/`Accept`/`Undo(Follow)` handling, `Create(Article)` fanout, `group_followers` table, `federation_outbox` + delivery worker.

Schema additions: `ap_id` + `ap_public_key` + `ap_private_key` on `groups`; `ap_id` on `posts`; `group_followers` table; `federation_outbox` table; WebFinger route.

**Estimated effort: 4–6 weeks** (one developer, familiar with the codebase). This is not small. HTTP signatures alone are a week of work if done from scratch; `@fedify/fedify` reduces it to days but adds a library dependency to evaluate.

**Level 2 — Bidirectional (comments from fediverse):** Adds inbound `Create(Note)` (comments from remote users), `Delete`, and `Announce`. Remote users get synthetic local user rows. The moderation pipeline handles inbound content.

Additional schema: `remote_actors` table; `federation_inbox` table; `remote=true` support on `users`, `posts`, `comments`; inbox processing worker.

**Additional estimated effort: 3–5 weeks** on top of Level 1. The moderation integration is conceptually straightforward but the inbox processing logic (deduplication, signature verification, actor fetch) is fiddly.

**Level 3 — Full federation:** Adds `Update` (edit support — Earthropy does not have editing in v0.1), `Like`/`Announce` reactions, group membership bridging, inter-instance reputation vouching, and instance blocking UI. This is the level at which Earthropy would feel like a first-class fediverse citizen.

**Additional estimated effort: 6–10 weeks.** Much of this effort is product work (what does editing mean for moderated content? what does a blocked-domain UI look like?) as much as protocol work.

### 5.2 Recommended version target

**Do not implement federation in v0.2.**

v0.2 is already scoped around the Plugin SDK, AI community manager, and CI infrastructure. Those items are prerequisites for federation: the Plugin SDK provides the extension points that a federation package would use; CI is necessary before adding a complex subsystem with many edge cases.

**Target Level 1 for v0.3, with Level 2 as a stretch goal.**

The reasoning:

1. Level 1 delivers most of the discoverability value with a bounded scope. SDG-focused groups appearing in Mastodon search and being followable is a meaningful outcome.
2. Earthropy's moderation pipeline is pre-publication. Inbound federated content (Level 2) requires careful design to maintain that guarantee without creating unacceptable latency (a Mastodon user's comment should not be invisible for 2 minutes while AI classification runs). A delivery acknowledgment vs. visible-to-others gap needs product design before implementation.
3. The protocol complexity is significant. Building it on top of a stable v0.2 codebase with CI in place reduces the risk of introducing hard-to-trace bugs.

**Minimum viable first step for v0.3:** Implement Level 1 only. Ship. Learn from real-world federation behavior (delivery failures, signature issues, instance compatibility) before committing to inbound interaction.

### 5.3 Dependencies and risks

**Dependencies:**

- `@fedify/fedify` (Apache 2.0, compatible with AGPL) — handles JSON-LD, actor/activity classes, and HTTP signature signing/verification. Strongly recommended over implementing from scratch. Evaluate against `activitypub-express` (MIT) as well; `fedify` is more TypeScript-native.
- RSA key generation and storage: Node's `crypto` module is sufficient for key generation; the storage strategy (env var, database column, external secret manager) is an ops decision.
- A delivery queue already exists (BullMQ). The `federation_outbox` worker uses the same infrastructure.

**Risks:**

- **Mastodon compatibility.** Mastodon's implementation of ActivityPub has quirks (the `draft-cavage` signatures, specific `Accept` header requirements, the `application/ld+json; profile=...` content type) that are not in the spec. Any implementation must be tested against a real Mastodon instance.
- **Key management.** Per-group RSA private keys require a secure storage strategy. An accidental key leak allows a malicious actor to forge activities from that group. This is a higher-stakes secret than a database password.
- **Moderation latency for inbound content.** Level 2 requires a clear policy decision: is inbound content held in `pending_ai` (invisible to all local users until classified)? Or is it visible immediately and retracted if rejected? The first is safe but creates a bad experience for remote commenters. The second is consistent with how most fediverse software works but weakens Earthropy's pre-publication guarantee.
- **Instance block list management.** Without tooling to defederate bad actors at the instance level, moderators are stuck blocking individual remote accounts. This is a governance decision as much as a technical one.

---

## 6. Prior art

### Lemmy

The most relevant reference. Lemmy federates community-based content: posts belong to communities, communities can be followed from any AP-compatible client, and users on one Lemmy instance can post to communities on another. Lemmy's group-as-actor model maps almost directly to Earthropy's group-as-actor model.

Key learnings from Lemmy's implementation:
- Communities (groups) are the primary AP actor type (`Group`).
- Posts are `Page` objects (a subset of `Article`), attributed to both the author and the community.
- The moderation pipeline for remote posts is a known hard problem; Lemmy handles it by trusting the originating instance's moderation.
- Lemmy's federation code lives in `crates/apub/` (Rust). The patterns are transferable even if the language is not.

### Mastodon

The de-facto standard against which all AP implementations are tested for compatibility. Mastodon federates user-to-user content (notes, follows, likes). Groups are not a native Mastodon concept; it handles `Follow` to a `Group` actor but does not fully implement the group semantics. Testing Earthropy federation against a Mastodon instance is required to validate signature handling and content type negotiation.

### Discourse (ActivityPub plugin)

Discourse added an AP plugin that makes topics followable from the fediverse. The implementation is partial (no inbound posting from remote users) and illustrates the read-only outbound approach as a viable first step. The plugin is MIT-licensed.

### BookWyrm

A book-review platform built on ActivityPub. Notable for: (a) being a domain-specific social platform rather than a generic microblogging one, (b) handling rich `Article`-type objects with metadata, and (c) shipping production federation with a small team. The BookWyrm codebase (AGPL-3.0) is a reasonable reference for how a non-Mastodon AP implementation handles the protocol.

### Libraries

| Library | License | Language | Notes |
|---|---|---|---|
| `@fedify/fedify` | Apache 2.0 | TypeScript | Most complete TS AP library; handles JSON-LD, HTTP signatures, actor/activity classes, WebFinger. Actively maintained. First choice. |
| `activitypub-express` | MIT | JavaScript/TypeScript | Middleware-style; less opinionated. Less maintained than fedify as of 2026. |
| `@activity-kit` | MIT | TypeScript | Lower-level; closer to raw AP objects. More control, more work. |

`@fedify/fedify` is the recommended starting point. Its Apache 2.0 license is compatible with AGPL-3.0. Before committing, verify the current release's WebFinger and HTTP signature behavior against a Mastodon instance.

---

## 7. Open questions for implementation

These questions are not answered by this spike and must be resolved before Level 1 implementation begins:

1. **Key storage strategy.** Where are group RSA private keys stored? Options: encrypted database column (requires KMS or application-level encryption), secret manager (Vault, AWS Secrets Manager — complicates self-host story), environment variable per group (impractical at scale). This is a blocking decision.

2. **Moderation policy for inbound Level 2 content.** Is inbound content held in `pending_ai` before becoming visible to local users? If yes: what is the expected latency and is it acceptable for a comment to be invisible for up to 30 seconds? If no: what is the rollback story when content is rejected after being briefly visible?

3. **Instance blocking UI and governance.** Who can defederate an instance on the hosted Earthropy? Is this a platform admin decision, a group moderator decision, or both? The answer shapes the data model for blocked domains.

4. **SDG taxonomy propagation.** When a post is federated out as an `Article`, should the SDG tags appear as `tag` objects with `href` pointing to `packages/sdg` canonical URIs? This would allow other instances to filter by SDG. It requires a stable public URI for each SDG (e.g., `https://earthropy.org/sdg/13`).

5. **Group visibility and federation.** `private` groups should not be federatable. `listed` groups: should they be followable from the fediverse but not appear in WebFinger lookups? The current `groupVisibility` enum (`public | listed | private`) needs a mapping to AP concepts.
