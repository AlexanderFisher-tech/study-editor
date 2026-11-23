# Antigravity Study Editor

Minimalist, Notion-style interactive study note editor compiled into a self-contained IIFE bundle (`dist/study-editor.min.js` and `dist/study-editor.min.css`) for Gemini Canvas preview iframes.

## Commands

```bash
npm run build          # Type-check + build dist/study-editor.min.js & dist/study-editor.min.css
npm run test:unit      # Run Vitest unit tests (sanitizer, storage/sync diff, markdown export)
npm run verify:bundle  # Verify <= 40 KB combined gzipped size & zero alert()/confirm() calls
npm run test:e2e       # Run Playwright Chromium E2E tests against examples/sample-note.html
npm test               # Run full build + unit + bundle + E2E verification suite
```

## Publishing to jsDelivr (`v1.0.0`)

`cdn.jsdelivr.net/gh/<owner>/<repo>@v1.0.0/dist/...` serves files committed directly inside the Git tree of the tag (not binary assets uploaded to a GitHub Release page). Keep `dist/study-editor.min.js` and `dist/study-editor.min.css` tracked in Git before tagging:

```bash
npm test
git add dist/study-editor.min.js dist/study-editor.min.css
git commit -m "Build v1.0.0 bundle"
git tag v1.0.0
git push origin main --tags
git ls-tree v1.0.0 dist/
```

Verify the jsDelivr URLs resolve with HTTP 200:
- `https://cdn.jsdelivr.net/gh/AlexanderFisher-tech/study-editor@v1.0.0/dist/study-editor.min.js`
- `https://cdn.jsdelivr.net/gh/AlexanderFisher-tech/study-editor@v1.0.0/dist/study-editor.min.css`

## `@study-notes-style` Skill Loader Template

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Note Title</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/AlexanderFisher-tech/study-editor@v1.0.0/dist/study-editor.min.css" />
</head>
<body>
  <div id="study-root"></div>
  <script id="note-data" type="application/json">
  {
    "noteId": "example-note-01",
    "version": 1,
    "title": "Note Title",
    "blocks": [
      { "id": "b1", "type": "paragraph", "html": "Start writing..." }
    ]
  }
  </script>
  <script
    src="https://cdn.jsdelivr.net/gh/AlexanderFisher-tech/study-editor@v1.0.0/dist/study-editor.min.js"
    onerror="(function(){var r=document.getElementById('study-root'),d=document.getElementById('note-data');if(!r||!d)return;try{var n=JSON.parse(d.textContent||'{}');r.innerHTML='<div style=&quot;padding:24px;font-family:sans-serif;&quot;><p style=&quot;color:#f59e0b;font-size:12px;&quot;>Offline / Read-Only Fallback (CDN unreachable)</p><h1>'+(n.title||'')+'</h1>'+(n.blocks||[]).map(function(b){return '<div style=&quot;margin:12px 0;&quot;>'+(b.html||b.code||'')+'</div>';}).join('')+'</div>';}catch(e){r.textContent='Failed to parse #note-data JSON.';}})()"
  ></script>
</body>
</html>
```
