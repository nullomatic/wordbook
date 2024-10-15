import Translator from "./components/Translator";

export default function TranslatorPage() {
  return (
    <div className="mx-auto w-full max-w-screen-xl space-y-9 px-3 py-24 2xl:px-0">
      <div className="text-center font-fraktur text-5xl font-bold">
        The Translator
      </div>

      <Translator />

      <div className="mx-auto max-w-3xl space-y-6 pt-12 font-serif text-sm leading-loose">
        <h1 className="text-2xl font-bold">Sample Inkhorn Text</h1>
        <p>
          The professor’s analysis of the complex scientific phenomenon was
          incredibly thorough, as he endeavored to elucidate the intricacies of
          the chemical reactions involved. Despite the meticulous preparations,
          the experiment demonstrated unexpected anomalies that required
          immediate consideration. Collaboration with international colleagues
          led to a comprehensive review of the hypotheses. Ultimately, their
          collective research culminated in a breakthrough discovery that
          revolutionized the understanding of molecular interactions. The
          academic community lauded their contribution, recognizing the profound
          implications for future technological advancements and medical
          innovations.
        </p>
        <p>
          The development of modern society has been influenced by a variety of
          factors, including political systems, economic growth, and cultural
          exchanges. The government plays a crucial role in the regulation of
          industries, while education and innovation remain essential for
          long-term prosperity. Many individuals seek opportunities to enhance
          their status through professional achievements and personal endeavors.
          The evolution of communication technologies has further facilitated
          global interaction, bringing both challenges and benefits to diverse
          communities.
        </p>
      </div>
    </div>
  );
}
