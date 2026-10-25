# 臺北市區最塞路段排行

GitHub Pages deployment package for the live Taipei traffic dashboard. GitHub Actions publishes the static files from `dist/` on every push to `main`.

- Live site: https://appjust.github.io/taipei-traffic-radar/

- Data source: Taipei City Traffic Engineering Office, [government open data](https://data.gov.tw/dataset/128709)
- Attribution: 資通系 李振偉老師
- Static app files: `dist/`
- Deployment workflow: `.github/workflows/pages.yml`

To publish the site, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. Then push or rerun the Pages workflow.

