import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacidade | PV Moda Masculina",
  description: "Rascunho do aviso de privacidade da PV Moda Masculina.",
};

export default function PrivacyPage() {
  return (
    <article className="store-container legal-page">
      <header>
        <p className="section-kicker">Seus dados</p>
        <h1>Aviso de privacidade</h1>
        <p>Última atualização: 14 de julho de 2026.</p>
      </header>
      <aside className="legal-draft">Rascunho pré-venda: canais, fornecedores e prazos devem ser confirmados pela responsável da loja antes da abertura ao público.</aside>
      <section><h2>Dados utilizados</h2><p>Para atender pedidos, a loja pode tratar nome, telefone, e-mail, endereço de entrega, itens comprados, valores e registros de pagamento. Dados completos de cartão não são recebidos nem armazenados pela loja.</p></section>
      <section><h2>Finalidades</h2><p>Os dados são usados para criar e entregar pedidos, confirmar pagamentos, prestar atendimento, prevenir fraude, cumprir obrigações legais e manter registros comerciais.</p></section>
      <section><h2>Compartilhamento</h2><p>Somente compartilhamos o necessário com operadores que sustentam a loja, como hospedagem, banco de dados, autenticação, pagamento e, quando contratado, envio de e-mails ou logística. Cada fornecedor trata dados conforme sua função e seus próprios termos.</p></section>
      <section><h2>Retenção e segurança</h2><p>Os registros são mantidos pelo período necessário às finalidades acima e às obrigações legais. Aplicamos controles de acesso, segredos no servidor e minimização de dados em logs, embora nenhum sistema elimine completamente os riscos.</p></section>
      <section><h2>Seus direitos</h2><p>Você pode pedir confirmação do tratamento, acesso, correção, informações sobre compartilhamento e, quando aplicável, anonimização, bloqueio, eliminação, portabilidade ou revisão de decisões automatizadas. Use os canais de atendimento do rodapé para fazer uma solicitação.</p></section>
      <section><h2>Referências</h2><p>Leia a <a href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm" rel="noreferrer" target="_blank">Lei Geral de Proteção de Dados</a> e as <a href="https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares" rel="noreferrer" target="_blank">orientações da ANPD aos titulares</a>.</p></section>
    </article>
  );
}
