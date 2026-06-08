import { ComoFunciona } from "./components/ComoFunciona";
import { Contato } from "./components/Contato";
import { Footer } from "./components/Footer";

export default function Home() {
  return (
    <>
      <div className="wrap">
        <nav>
          <a className="brand" href="#" aria-label="Jasmin">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Jasmin" />
          </a>
          <div className="nav-links">
            <a href="#contato" className="btn btn-solid btn-md">
              Entre em contato
            </a>
          </div>
        </nav>
      </div>

      <header className="hero">
        <div className="wrap hero-inner">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="dot" />
              Assistência Clínica com IA
            </span>

            <h1>
              Otimize suas consultas
              <br />
              com inteligência artificial
            </h1>

            <p className="lead">
              Jasmin transcreve e resume seus atendimentos em tempo real. Você
              foca no paciente, nossa IA cuida do prontuário.
            </p>

            <div className="cta-row">
              <a href="#contato" className="btn btn-solid btn-xl">
                Entre em contato{" "}
                <span className="arrow" aria-hidden="true">
                  →
                </span>
              </a>
            </div>
          </div>
        </div>

        <div className="hero-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/woman.png"
            alt="Paciente em consulta odontológica com anotações clínicas geradas por IA"
          />
        </div>
      </header>

      <div className="wrap features-wrap">
        <div className="features-strip">

          <div className="feature-item">
            <p className="feature-title">Transcrição</p>
            <p className="feature-desc">Consultas registradas automaticamente enquanto acontecem.</p>
          </div>

          <div className="feature-divider" />

          <div className="feature-item">
            <p className="feature-title">Prontuário automático</p>
            <p className="feature-desc">Resumo clínico estruturado gerado ao fim de cada atendimento.</p>
          </div>

          <div className="feature-divider" />

          <div className="feature-item">
            <p className="feature-title">Integra ao seu fluxo</p>
            <p className="feature-desc">Sem curva de aprendizado, pronto para usar.</p>
          </div>

          <div className="feature-divider" />

          <div className="feature-item">
            <p className="feature-title">Validado por dentistas</p>
            <p className="feature-desc">Outputs clínicos revisados por profissionais reais.</p>
          </div>

        </div>
      </div>

      <ComoFunciona />

      <section className="nf" id="features">
        <div className="wrap">
          <div className="nf-head">
            <h2 className="nf-heading">
              Mais do que transcrição.
              <br />
              Um ERP que pensa com você.
            </h2>
            <p className="nf-desc">
              Jasmin fecha o ciclo completo — do prontuário à guia de convênio.
            </p>
          </div>

          <div className="nf-grid">

            <div className="nf-card">
              <div className="nf-card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3 className="nf-card-title">Pergunte qualquer coisa sobre seus pacientes</h3>
              <p className="nf-card-desc">
                Um agente com memória completa da clínica. Selecione uma consulta ou paciente na tela e adicione ao chat como contexto. Pergunte sobre interações medicamentosas, histórico de tratamento, próximas consultas — em linguagem natural.
              </p>
            </div>

            <div className="nf-card">
              <div className="nf-card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <h3 className="nf-card-title">Guias sem adivinhação</h3>
              <p className="nf-card-desc">
                O agente de cobrança lê o prontuário, mapeia os códigos TUSS corretos, verifica as regras do convênio e gera a guia TISS — sinalizando riscos de glosa antes de você enviar.
              </p>
            </div>

            <div className="nf-card">
              <div className="nf-card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>
              <h3 className="nf-card-title">Cada campo cita sua fonte</h3>
              <p className="nf-card-desc">
                Cada campo do prontuário gerado vincula de volta ao trecho exato da transcrição que o originou. Clique para ver o destaque. Confie, mas verifique.
              </p>
            </div>

          </div>
        </div>
      </section>

      <Contato />
      <Footer />
    </>
  );
}
