export default function DocsIndex() {
  return (
    <main>
      <h1>Earthropy Documentation</h1>
      <p>
        Source-of-truth docs live in <code>/docs/*.md</code> alongside the codebase. This site
        renders them; content is added as v0.1 features land.
      </p>
      <ul>
        <li>
          <a href="/getting-started">Getting Started</a>
        </li>
        <li>
          <a href="/self-host">Self-Hosting</a>
        </li>
        <li>
          <a href="/moderation-policy">Moderation Policy</a>
        </li>
        <li>
          <a href="/governance">Governance</a>
        </li>
      </ul>
    </main>
  );
}
