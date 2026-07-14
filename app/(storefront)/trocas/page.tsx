import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trocas e devoluções | PV Moda Masculina",
  description: "Rascunho da política de trocas, devoluções e arrependimento da PV Moda Masculina.",
};

export default function ExchangesPage() {
  return (
    <article className="store-container legal-page">
      <header>
        <p className="section-kicker">Atendimento pós-compra</p>
        <h1>Trocas e devoluções</h1>
        <p>Última atualização: 14 de julho de 2026.</p>
      </header>
      <aside className="legal-draft">Rascunho pré-venda: este conteúdo deve ser revisado pela responsável da loja antes da abertura ao público.</aside>
      <section><h2>Arrependimento em compras online</h2><p>Em compras realizadas fora do estabelecimento comercial, você pode solicitar o cancelamento em até 7 dias corridos contados do recebimento do produto, conforme o artigo 49 do Código de Defesa do Consumidor.</p></section>
      <section><h2>Como solicitar</h2><p>Entre em contato pelos canais exibidos no rodapé, informe o número do pedido e descreva o motivo. A loja orientará a forma de devolução e manterá o atendimento registrado.</p></section>
      <section><h2>Condições do produto</h2><p>Sempre que possível, preserve etiquetas, acessórios e embalagem e não utilize ou lave a peça. Essas condições ajudam a análise, sem limitar os direitos legais em caso de defeito ou desconformidade.</p></section>
      <section><h2>Defeito ou item incorreto</h2><p>Avise a loja assim que identificar defeito, avaria, tamanho ou produto diferente do pedido. A solução seguirá os prazos e alternativas previstos na legislação aplicável.</p></section>
      <section><h2>Reembolso</h2><p>Quando o reembolso for devido, ele será solicitado pelo mesmo meio de pagamento. O prazo de crédito pode variar conforme o provedor e a instituição financeira.</p></section>
      <section><h2>Referência</h2><p>Consulte o <a href="https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm" rel="noreferrer" target="_blank">Código de Defesa do Consumidor</a>. Este texto informa o fluxo da loja e não substitui a legislação.</p></section>
    </article>
  );
}
