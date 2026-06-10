"use client";

import { motion } from "framer-motion";
import { ComoFunciona } from "./components/ComoFunciona";
import { Contato } from "./components/Contato";
import { Footer } from "./components/Footer";
import { FadeUp, staggerContainer, staggerItem } from "./components/Animate";
import { JasminDiagram } from "./components/JasminDiagram";

const ease = [0.25, 0.1, 0.25, 1] as const;

export default function Home() {
  return (
    <>
      {/* ── Nav ─────────────────────────────────────────── */}
      <motion.div
        className="wrap"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
      >
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
      </motion.div>

      {/* ── Hero ─────────────────────────────────────────── */}
      <header className="hero">
        <div className="wrap hero-inner">
          <div className="hero-copy">
            <motion.span
              className="eyebrow"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease }}
            >
              <span className="dot" />
              Assistência Clínica com IA
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.25, ease }}
            >
              Otimize suas consultas
              <br />
              com inteligência artificial
            </motion.h1>

            <motion.p
              className="lead"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.4, ease }}
            >
              Jasmin transcreve e resume seus atendimentos em tempo real. Você
              foca no paciente, nossa IA cuida do prontuário.
            </motion.p>

            <motion.div
              className="cta-row"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.55, ease }}
            >
              <a href="/consulta" className="btn btn-solid btn-xl">
                Testar Demo{" "}
                <span className="arrow" aria-hidden="true">
                  →
                </span>
              </a>
            </motion.div>
          </div>
        </div>

        <motion.div
          className="hero-media"
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.2, ease }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/woman.png"
            alt="Paciente em consulta odontológica com anotações clínicas geradas por IA"
          />
        </motion.div>
      </header>

      {/* ── Features strip ───────────────────────────────── */}
      <div className="wrap features-wrap">
        <motion.div
          className="features-strip"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          <motion.div className="feature-item" variants={staggerItem}>
            <p className="feature-title">Transcrição</p>
            <p className="feature-desc">Consultas registradas automaticamente enquanto acontecem.</p>
          </motion.div>

          <motion.div className="feature-divider" variants={staggerItem} />

          <motion.div className="feature-item" variants={staggerItem}>
            <p className="feature-title">Prontuário automático</p>
            <p className="feature-desc">Resumo clínico estruturado gerado ao fim de cada atendimento.</p>
          </motion.div>

          <motion.div className="feature-divider" variants={staggerItem} />

          <motion.div className="feature-item" variants={staggerItem}>
            <p className="feature-title">Integra ao seu fluxo</p>
            <p className="feature-desc">Sem curva de aprendizado, pronto para usar.</p>
          </motion.div>

          <motion.div className="feature-divider" variants={staggerItem} />

          <motion.div className="feature-item" variants={staggerItem}>
            <p className="feature-title">Validado por dentistas</p>
            <p className="feature-desc">Outputs clínicos revisados por profissionais reais.</p>
          </motion.div>
        </motion.div>
      </div>

      {/* ── Como Funciona ─────────────────────────────────── */}
      <ComoFunciona />

      {/* ── Seção 3 — Bento Grid ─────────────────────────── */}
      <section className="nb" id="features">
        <div className="wrap">
          <FadeUp>
            <div className="nb-head">
              <h2 className="nb-heading">Uma plataforma que pensa com você.</h2>
              <p className="nb-desc">
                Jasmin fecha o ciclo completo, do prontuário à guia de convênio.
              </p>
            </div>
          </FadeUp>

          <div className="nb-grid">
            {/* Card principal — Jasmin Assistant com diagrama */}
            <motion.div
              className="nb-card nb-card--main"
              initial={{ opacity: 0, x: -32 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.65, ease }}
            >
              <div>
                <div className="nb-card-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h3 className="nb-card-title nb-card-title--lg">
                  Pergunte qualquer coisa sobre seus pacientes
                </h3>
                <p className="nb-card-desc">
                  Um agente com memória completa da clínica, acessível em linguagem natural.
                </p>
              </div>
              <JasminDiagram />
            </motion.div>

            {/* Card — Cobrança */}
            <motion.div
              className="nb-card nb-card--billing"
              initial={{ opacity: 0, x: 32 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.65, delay: 0.1, ease }}
              whileHover={{ y: -4, boxShadow: "0 16px 44px rgba(252,94,14,0.13)" }}
            >
              <div className="nb-card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <p className="nb-card-eyebrow">Cobrança</p>
              <h3 className="nb-card-title">Guias sem adivinhação</h3>
              <p className="nb-card-desc">
                Mapeia códigos TUSS, verifica as regras do convênio e gera a guia TISS.
              </p>
            </motion.div>

            {/* Card — Fonte citada */}
            <motion.div
              className="nb-card"
              initial={{ opacity: 0, x: 32 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.65, delay: 0.2, ease }}
              whileHover={{ y: -4, boxShadow: "0 16px 44px rgba(27,23,20,0.09)" }}
            >
              <div className="nb-card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>
              <h3 className="nb-card-title">Cada campo cita sua fonte</h3>
              <p className="nb-card-desc">
                Cada campo vincula ao trecho exato da transcrição que o originou. Clique para confirmar.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Contato ──────────────────────────────────────── */}
      <FadeUp>
        <Contato />
      </FadeUp>

      <Footer />
    </>
  );
}
