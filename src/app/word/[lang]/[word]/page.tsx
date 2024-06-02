export default function Page({
  params,
}: {
  params: { lang: string; word: string };
}) {
  return <div>Route: {`/word/${params.lang}/${params.word}`}</div>;
}
