// Brand assets live in portalCliente/public/images, served under the portal's base path.
const IMG = `${import.meta.env.BASE_URL}images`;

export const LOGO_EMBLEMA = `${IMG}/ruiz-inmobiliaria-emblema-256.png`; // crown + RI, transparent, white letters (256px web copy)
export const LOGO_COMPLETO = `${IMG}/ruiz-inmobiliaria-imagen-03.jpg`;   // framed emblem + RUIZ INMOBILIARIA, on black

type MarcaProps = {
  /** "oscuro" sits on the brand black; "claro" on white or cream. */
  fondo?: 'oscuro' | 'claro';
  size?: 'sm' | 'md' | 'lg';
  /** Show the RUIZ / INMOBILIARIA wordmark next to the emblem. */
  conTexto?: boolean;
  subtitulo?: string;
};

const EMBLEMA_SIZE = { sm: 'w-9 h-9', md: 'w-11 h-11', lg: 'w-16 h-16' };
const RUIZ_SIZE = { sm: 'text-lg', md: 'text-xl', lg: 'text-3xl' };

/**
 * The logo's letters are white, so on light backgrounds the emblem sits on a
 * black tile, as on the brand's printed material.
 */
export function Marca({ fondo = 'oscuro', size = 'md', conTexto = true, subtitulo }: MarcaProps) {
  const emblema = (
    <img
      src={LOGO_EMBLEMA}
      alt={conTexto ? '' : 'Ruiz Inmobiliaria'}
      className={`${EMBLEMA_SIZE[size]} object-contain ${fondo === 'claro' ? 'bg-marca-negro rounded-xl p-1' : ''}`}
    />
  );

  if (!conTexto) return emblema;

  const tono = fondo === 'oscuro' ? 'text-white' : 'text-marca-negro';
  return (
    <div className="flex items-center gap-3" aria-label="Ruiz Inmobiliaria">
      {emblema}
      <div className="leading-none">
        <p className={`font-display font-extrabold tracking-wide ${RUIZ_SIZE[size]} ${tono}`}>RUIZ</p>
        <p className={`font-display font-medium uppercase tracking-[0.22em] text-[10px] mt-1 ${fondo === 'oscuro' ? 'text-marca-oro' : 'text-teal-700'}`}>
          Inmobiliaria
        </p>
        {subtitulo && (
          <p className={`mt-1.5 text-[11px] ${fondo === 'oscuro' ? 'text-gray-400' : 'text-gray-500'}`}>{subtitulo}</p>
        )}
      </div>
    </div>
  );
}
