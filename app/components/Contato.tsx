"use client";

import { useState } from "react";

// Troque pelo seu endpoint do Formspree: https://formspree.io/f/XXXXXXXX
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xrevzklg";

type Status = "idle" | "sending" | "success" | "error";

export function Contato() {
  const [status, setStatus] = useState<Status>("idle");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setStatus("sending");
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });
      if (!res.ok) throw new Error("Falha no envio.");
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
    }
  };

  return (
    <section className="ct" id="contato">
      <div className="wrap ct-inner">
        <div className="ct-head">
          <span className="eyebrow ct-eyebrow">
            <span className="dot" />
            Contato
          </span>
          <h2 className="ct-title">Vamos conversar.</h2>
          <p className="ct-desc">
            A Jasmin está em fase inicial, com acesso por convite. Deixe seu
            contato e retornamos para uma conversa.
          </p>
        </div>

        {status === "success" ? (
          <div className="ct-success">
            <p className="ct-success-title">Recebido. Obrigado!</p>
            <p className="ct-success-text">
              Em breve entraremos em contato pelo e-mail informado.
            </p>
          </div>
        ) : (
          <form className="ct-form" onSubmit={onSubmit}>
            <div className="ct-row">
              <label className="ct-field">
                <span>Nome</span>
                <input type="text" name="nome" required placeholder="Seu nome" />
              </label>
              <label className="ct-field">
                <span>E-mail</span>
                <input type="email" name="email" required placeholder="voce@email.com" />
              </label>
            </div>

            <label className="ct-field">
              <span>Função (opcional)</span>
              <input
                type="text"
                name="funcao"
                placeholder="Dentista, médico(a), clínica…"
              />
            </label>

            <label className="ct-field">
              <span>Mensagem</span>
              <textarea
                name="mensagem"
                rows={4}
                placeholder="Conte um pouco sobre você e seu interesse."
              />
            </label>

            {status === "error" && (
              <p className="ct-error">
                Não foi possível enviar agora. Tente novamente em instantes.
              </p>
            )}

            <button type="submit" className="btn btn-solid btn-lg ct-submit" disabled={status === "sending"}>
              {status === "sending" ? "Enviando…" : "Enviar"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
