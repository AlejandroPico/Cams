import { useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AboutModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="about-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article className="about-card">
        <button className="about-close" type="button" onClick={onClose} aria-label="Cerrar acerca de" autoFocus>×</button>

        <div className="about-mark" aria-hidden="true">
          <img src={`${import.meta.env.BASE_URL}icons/favicon.svg`} alt="" />
          <i />
        </div>

        <span className="about-kicker">EXPLORADOR MUNDIAL DE CÁMARAS</span>
        <h1 id="about-title">Acerca de Cams</h1>
        <p className="about-lead">
          Cams reúne cámaras públicas, emisiones en directo y capturas periódicas en una sola ventana abierta al mundo.
          Su mapa y su mosaico permiten descubrir lugares, carreteras, costas y ciudades desde una interfaz común.
        </p>

        <div className="about-grid">
          <section>
            <small>EL PROYECTO</small>
            <h2>Explorar un planeta conectado</h2>
            <p>
              El catálogo combina fuentes públicas y redes oficiales, unifica sus formatos y facilita recorrerlas por
              país, categoría, disponibilidad y tipo de emisión. Cams es un proyecto abierto que seguirá creciendo a
              medida que se incorporen nuevas fuentes reutilizables.
            </p>
          </section>
          <section>
            <small>EL AUTOR</small>
            <h2>Alejandro Pico</h2>
            <p>
              Proyecto concebido y desarrollado como parte de una colección de aplicaciones interactivas dedicadas a
              la tecnología, la cartografía y la divulgación visual.
            </p>
          </section>
        </div>

        <nav className="about-links" aria-label="Enlaces de Cams">
          <a href="https://alejandropico.github.io/Portfolio/" target="_blank" rel="noopener noreferrer">
            <span>Conocer al autor y sus proyectos</span>
            <b>Portfolio ↗</b>
          </a>
          <a href="https://github.com/AlejandroPico/Cams" target="_blank" rel="noopener noreferrer">
            <span>Código y documentación del proyecto</span>
            <b>GitHub ↗</b>
          </a>
        </nav>

        <footer>
          <span>CAMS</span>
          <small>Diseñado por Alejandro Pico</small>
        </footer>
      </article>
    </div>
  );
}
