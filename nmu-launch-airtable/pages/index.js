// The app lives in public/index.html. Send visitors at "/" there.
// Done on the server so it works on any host that runs Next.js (Amplify, Vercel, `next start`).
export async function getServerSideProps() {
  return { redirect: { destination: '/index.html', permanent: false } };
}

export default function Home() {
  return null;
}
