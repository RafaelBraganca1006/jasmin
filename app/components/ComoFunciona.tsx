"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, HeartPulse, Receipt } from "lucide-react";
import { FadeUp } from "./Animate";

interface StepContent {
  badge?: string;
  title: React.ReactNode;
  description: string;
}

interface Step {
  value: string;
  icon: React.ReactNode;
  label: string;
  image: string;
  imageAlt: string;
  content: StepContent;
}

const ease = [0.25, 0.1, 0.25, 1] as const;

const STEPS: Step[] = [
  {
    value: "tempo",
    icon: <Clock className="hf-tab-icon" />,
    label: "Ganhe tempo",
    image: "/aba-tempo.png",
    imageAlt: "Profissional de saúde",
    content: {
      badge: "Mais produtividade",
      title: (
        <>
          Recupere horas
          <br />
          do seu dia.
        </>
      ),
      description:
        "Jasmin escuta a consulta e escreve o prontuário por você. Sem digitar, você atende mais pacientes e termina o dia sem papelada acumulada.",
    },
  },
  {
    value: "foco",
    icon: <HeartPulse className="hf-tab-icon" />,
    label: "Foco no paciente",
    image: "/aba-foco.png",
    imageAlt: "Profissional de saúde em atendimento ao paciente",
    content: {
      badge: "Mais presença",
      title: (
        <>
          Olhe para
          <br />
          quem importa.
        </>
      ),
      description:
        "Tire os olhos da tela e volte para o paciente. Enquanto vocês conversam, a inteligência artificial cuida do registro clínico em tempo real.",
    },
  },
  {
    value: "convenios",
    icon: <Receipt className="hf-tab-icon" />,
    label: "Sem glosas",
    image: "/aba-dados.png",
    imageAlt: "Guia de convênio gerada automaticamente",
    content: {
      badge: "Cobrança automática",
      title: (
        <>
          Guia certa
          <br />
          da primeira vez.
        </>
      ),
      description:
        "Jasmin lê o prontuário, mapeia os códigos TUSS corretos e verifica as regras do convênio do paciente antes de gerar a guia TISS.",
    },
  },
];

export function ComoFunciona() {
  const [active, setActive] = useState(STEPS[0].value);
  const currentStep = STEPS.find((s) => s.value === active)!;

  return (
    <section className="hf" id="como-funciona">
      <div className="wrap">
        <FadeUp>
          <div className="hf-head">
            <h2 className="hf-heading">
              Nós transformamos consultas
              <br />
              em documentação clínica.
            </h2>
            <p className="hf-desc">Menos burocracia, mais cuidado.</p>
          </div>
        </FadeUp>

        <FadeUp delay={0.1}>
          <Tabs value={active} onValueChange={setActive} className="hf-tabs">
            <TabsList className="hf-tablist">
              {STEPS.map((step) => (
                <TabsTrigger
                  key={step.value}
                  value={step.value}
                  className="hf-trigger"
                >
                  {step.icon}
                  {step.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="hf-panel">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  className="hf-content"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.28, ease }}
                >
                  <div className="hf-text">
                    {currentStep.content.badge && (
                      <span className="hf-badge">{currentStep.content.badge}</span>
                    )}
                    <h3 className="hf-title">{currentStep.content.title}</h3>
                    <p className="hf-paragraph">{currentStep.content.description}</p>
                  </div>
                  <div className="hf-media">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentStep.image}
                      alt={currentStep.imageAlt}
                      className="hf-image"
                    />
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </Tabs>
        </FadeUp>
      </div>
    </section>
  );
}
