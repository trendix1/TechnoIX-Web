README - Steps to finish Google Search Console verification and deploy

1) Replace the placeholder value REPLACE_WITH_GOOGLE_TOKEN inside each HTML file head with the meta token Google Search Console gives you (or use the TXT record method in your DNS).

2) Edit sitemap.xml to replace https://example.com/ with your actual site URL.

3) Upload all files to your web host root (index.html at /, about.html at /about.html, contact.html at /contact.html, robots.txt at /robots.txt, sitemap.xml at /sitemap.xml).

4) In Google Search Console, add your site (preferably as a domain property) and verify using the meta tag or DNS method. After verification, submit the sitemap URL: https://your-site.com/sitemap.xml

Notes:
- Client-side tamper detection is included, but it cannot prevent server-side edits. If you need stronger protection, configure server-side permissions and file access controls.
- For HTTPS and better Search performance, enable HTTPS and proper headers on your host (HSTS, Content-Type, Content-Security-Policy via server).
