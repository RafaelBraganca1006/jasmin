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

              <span className="lgpd">
                <svg
                  width="15"
                  height="16"
                  viewBox="0 0 15 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3 6.8V4.7a4.5 4.5 0 0 1 9 0v2.1"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                  <rect
                    x="1.6"
                    y="6.8"
                    width="11.8"
                    height="8"
                    rx="2.2"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <circle cx="7.5" cy="10.6" r="1.15" fill="currentColor" />
                </svg>
                Conformidade LGPD garantida
              </span>
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
            <p className="feature-title">Conformidade LGPD</p>
            <p className="feature-desc">Dados clínicos criptografados de ponta a ponta.</p>
          </div>

          <div className="feature-divider" />

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
      <Contato />
      <Footer />
    </>
  );
}
