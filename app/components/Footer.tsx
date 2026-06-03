export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="ft">
      <div className="wrap ft-inner">
        <div className="ft-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Jasmin" className="ft-logo" />
          <p className="ft-tagline">
            Assistência clínica com inteligência artificial. Você cuida do
            paciente, a Jasmin cuida da documentação.
          </p>
        </div>

        <nav className="ft-nav">
          <span className="ft-nav-title">Navegação</span>
          <a href="#como-funciona">Como funciona</a>
          <a href="#contato">Contato</a>
        </nav>

        <nav className="ft-nav">
          <span className="ft-nav-title">Contato</span>
          <a href="#contato">Entre em contato</a>
        </nav>
      </div>

      <div className="wrap ft-bottom">
        <span>© {year} Jasmin. Todos os direitos reservados.</span>
        <span className="ft-lgpd">Conformidade LGPD</span>
      </div>
    </footer>
  );
}
