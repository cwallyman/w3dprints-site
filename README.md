# w3dprints-site

Scaffold for hosting multiple static webapps on GitHub Pages.

Structure:
- `docs/` - published root for GitHub Pages
- `docs/apps/<app>/` - static app folders
- `docs/CNAME` - your custom domain (`w3dprints.net`)
- `cloudflare/septa-next-trains-proxy/` - Worker for the Next Trains live API proxy

How to use:
1. Initialize a Git repo in this folder and push to GitHub.
2. In GitHub repository settings -> Pages, select `docs/` as the publish source.
3. Ensure `docs/CNAME` contains `w3dprints.net` and add the DNS records described in `docs/DNS-INSTRUCTIONS.md`.
// notes cname sig1._domainkey target:sig1.dkim.w3dprints.net.at.icloudmailadmin.com


to update to github
cd "/Users/cwallyman/Library/Mobile Documents/com~apple~CloudDocs/Coding/w3dprints-site"
git status
git add docs/index.html docs/assets "docs/apps/next trains"
git commit -m "Update homepage styling and app icons"
git push

Cloudflare Worker deploy for Next Trains
cd "/Users/cwallyman/Library/Mobile Documents/com~apple~CloudDocs/Coding/w3dprints-site/cloudflare/septa-next-trains-proxy"
wrangler deploy
