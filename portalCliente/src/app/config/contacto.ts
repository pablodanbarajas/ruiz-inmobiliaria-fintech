/**
 * Customer service contact details, shown in Soporte and the footer.
 * Change them here only. Phone and WhatsApp share the same number.
 */
const TELEFONO = '3335021654';

export const CONTACTO = {
  telefonoVisible: '33 3502 1654',
  telefonoHref: `tel:+52${TELEFONO}`,
  email: 'ventas@ruizinmobiliaria.com',
  direccion: 'Loma Seca Nte. 8171, Loma Dorada Delegación A, 45402 Tonalá, Jal.',
  // Office pin in Google Maps, as shared by the team.
  mapaHref: 'https://maps.app.goo.gl/8pzPvMzJxPb4SaAM6',
  horario: 'Lunes a viernes de 9:00 a 18:30 hrs',
} as const;

/** WhatsApp chat with the number, starting with a message the client can edit. */
export const whatsappHref = (mensaje: string) =>
  `https://wa.me/52${TELEFONO}?text=${encodeURIComponent(mensaje)}`;

export const emailHref = (asunto: string) =>
  `mailto:${CONTACTO.email}?subject=${encodeURIComponent(asunto)}`;
