// The app is a single static page (public/index.html) plus one API route
// (pages/api/airtable/[table].js). Next.js is only here so hosts like AWS Amplify
// can run that API route; the page itself is served as-is.
export default {
  async rewrites() {
    return [{ source: '/', destination: '/index.html' }];
  },
};
