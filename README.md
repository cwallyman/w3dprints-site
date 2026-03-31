w3dprints-site

Scaffold for hosting multiple static webapps on GitHub Pages.

Structure:
- `docs/` — published root for GitHub Pages
- `docs/apps/<app>/` — static app folders
- `docs/CNAME` — your custom domain (w3dprints.net)

How to use:
1. Initialize a Git repo in this folder and push to GitHub.
2. In GitHub repository settings -> Pages, select `docs/` as the publish source.
3. Ensure `docs/CNAME` contains `w3dprints.net` and add the DNS records described in docs/DNS-INSTRUCTIONS.md.

Want me to create a GitHub Action to deploy automatically or initialize git and push from here?"}},{