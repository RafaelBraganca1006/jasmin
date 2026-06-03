"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import { Clock, HeartPulse, ShieldCheck } from "lucide-react";

interface StepContent {
  badge: string;
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
    value: "privacidade",
    icon: <ShieldCheck className="hf-tab-icon" />,
    label: "Dados protegidos",
    image: "/aba-dados.png",
    imageAlt: "Pessoa tranquila, simbolizando privacidade e confiança",
    content: {
      badge: "Conformidade LGPD",
      title: (
        <>
          Privacidade
          <br />
          desde a origem.
        </>
      ),
      description:
        "Dados que identificam o paciente são removidos automaticamente. Nada é registrado sem a sua revisão — a decisão final é sempre sua.",
    },
  },
];

export function ComoFunciona() {
  return (
    <section className="hf" id="como-funciona">
      <div className="wrap">
        <div className="hf-head">
          <h2 className="hf-heading">
            Nós transformamos consultas
            <br />
            em documentação clínica.
          </h2>
          <p className="hf-desc">Menos burocracia, mais cuidado.</p>
        </div>

        <Tabs defaultValue={STEPS[0].value} className="hf-tabs">
          <TabsList className="hf-tablist">
            {STEPS.map((step) => (
              <TabsTrigger key={step.value} value={step.value} className="hf-trigger">
                {step.icon}
                {step.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="hf-panel">
            {STEPS.map((step) => (
              <TabsContent key={step.value} value={step.value} className="hf-content">
                <div className="hf-text">
                  <span className="hf-badge">{step.content.badge}</span>
                  <h3 className="hf-title">{step.content.title}</h3>
                  <p className="hf-paragraph">{step.content.description}</p>
                </div>
                <div className="hf-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={step.image} alt={step.imageAlt} className="hf-image" />
                </div>
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    </section>
  );
}
