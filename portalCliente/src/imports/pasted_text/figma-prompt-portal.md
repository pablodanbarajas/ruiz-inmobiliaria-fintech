Prompt para la IA de Figma

Crea un portal web de clientes para una inmobiliaria llamado Ruiz Inmobiliaria, basado en las imágenes de referencia que te voy a mostrar.
El objetivo es diseñar y generar una estructura funcional de frontend lista para crecer después con conexión a base de datos, mapa interactivo y datos reales.

Objetivo general

Quiero un portal de cliente moderno, limpio, profesional y fácil de usar, donde el usuario pueda:

ver los desarrollos/fraccionamientos disponibles,

revisar sus lotes,

consultar sus pagos pendientes e historial,

navegar fácilmente entre secciones desde un menú lateral,

y dejar la estructura lista para conectar después con:

base de datos,

mapa interactivo,

links de Google Maps,

recibos,

y futuras secciones.

Por ahora usa datos ficticios realistas, pero organiza todo para que después sea muy fácil reemplazarlos por datos reales.

Estilo visual general

Quiero que tomes como base el diseño de las imágenes:

Layout de escritorio

Menú lateral izquierdo fijo

Header superior simple

Contenido principal centrado

Tarjetas blancas con bordes redondeados

Diseño limpio, corporativo, claro y fácil de escanear

Fondo claro con acentos en tonos:

blanco

gris suave

azul petróleo / teal oscuro

dorado / mostaza suave para botones secundarios

Apariencia profesional de inmobiliaria, sin verse demasiado tecnológica ni demasiado minimalista.

El diseño debe transmitir confianza, orden, claridad y seguimiento del cliente.

Usa una interfaz que se vea como un portal real de clientes, no solo como landing page.

Estructura general del portal

El portal debe tener estas secciones en el menú lateral izquierdo:

Home

Mis lotes

Mis pagos

Soporte

Y debe quedar preparado para agregar más secciones después.

El menú lateral debe incluir también un bloque de contacto al final con:

teléfono,

correo,

dirección,

íconos de redes sociales.

En la parte superior derecha debe aparecer:

saludo al usuario, por ejemplo: Hola, Jonathan

ícono o avatar de perfil.

El portal debe incluir un footer corporativo como el de las imágenes, con columnas tipo:

logo y descripción de la empresa,

nosotros,

proyectos,

contacto.

1. Pantalla HOME

La pantalla Home debe mostrar los desarrollos/fraccionamientos disponibles.

Estructura del Home

En la parte superior:

Título de bienvenida, por ejemplo: Bienvenido Jonathan.

Barra de búsqueda horizontal para facilitar búsquedas.

La barra de búsqueda debe incluir:

campo o selector de Ubicación

campo o selector de Rango de precio

botón principal Buscar

Debajo, mostrar una lista de tarjetas de desarrollos.

Tarjetas de desarrollos

Cada desarrollo debe mostrarse como una tarjeta horizontal con:

imagen del desarrollo a la izquierda,

nombre del desarrollo,

cantidad de lotes disponibles,

ubicación resumida,

dos botones:

Ver lotes

Ver ubicación

Comportamiento de botones

Ver lotes: debe quedar preparado para enlazar con el mapa interactivo del desarrollo, que más adelante se conectará a base de datos. Por ahora puede ir a una vista placeholder o a una ruta vacía preparada.

Ver ubicación: debe abrir o dirigir a una liga externa de Google Maps.

Navegación desde Home

Desde esta pantalla también quiero que se pueda navegar a:

Mis lotes

Mis pagos

Puedes dejar botones rápidos, accesos directos o navegación clara desde el menú lateral.

Desarrollos ficticios de ejemplo

Usa datos ficticios como:

Pueblo de Barrancas

Vistas del Cielo

Senderos de San Miguel

Senderos de Piedra

Cada uno con imagen, disponibilidad y ubicación.

2. Pantalla MIS LOTES

Quiero que esta pantalla esté basada en la imagen de referencia de Mis lotes, pero mejor estructurada y lista para crecer.

Objetivo de la sección

Aquí el cliente podrá ver todos los lotes que tiene relacionados con su cuenta, clasificados por estatus:

apartados,

en pago,

finalizados,

o ya de su propiedad.

Encabezado de la sección

En la parte superior debe decir:

Mis lotes

subtítulo: algo como Consulta el estado de tus apartados y avance de compra

Tarjetas resumen superiores

Debajo del título, mostrar tres tarjetas resumen:

Lotes activos

número total de lotes activos del cliente

Próximo pago

monto próximo a pagar

texto visible como “vence hoy”, “vence pronto” o fecha

Lotes finalizados

cantidad de lotes ya liquidados o terminados

Filtros / pestañas

Debajo, incluir filtros tipo tabs o botones:

Todos

Apartados

En pagos

Finalizados

Lista de lotes

Más abajo debe haber una lista de tarjetas grandes, una por lote.

Estructura de cada tarjeta de lote

Cada tarjeta debe incluir:

imagen aérea o imagen del lote a la izquierda,

nombre o clave del lote, por ejemplo:

Lote 06-042

Lote 05-056

Lote 03-123

nombre del desarrollo,

ubicación,

superficie o medidas,

precio o valor del lote.

Estado y seguimiento

En la parte derecha de cada tarjeta debe verse un panel visual de estatus, por ejemplo:

Caso 1: Apartado

estatus: Apartado

subtítulo: Pago pendiente

temporizador o aviso de tiempo restante

botón: Pagar apartado

Caso 2: Enganche pendiente

estatus: Apartado confirmado

aviso: fecha límite de pago de enganche

botón: Pagar enganche

botón secundario: Ver detalle

Caso 3: En pagos

estatus: En pagos

aviso: próximo pago

botón: Ver siguiente paso

botón secundario: Ver detalle

Línea de avance o pasos

Dentro de la tarjeta del lote, agrega una pequeña línea de progreso del proceso, por ejemplo:

Solicitud

Pago de apartado

Enganche

Mensualidades

Liquidado

La idea es que visualmente el cliente entienda en qué etapa va cada lote.

Qué debe transmitir esta pantalla

Esta pantalla debe comunicar:

claridad,

avance del proceso,

acciones siguientes,

pagos pendientes,

y control del estado del lote.

Debe ser fácil de conectar después a datos reales y a la lógica de pagos.

3. Pantalla MIS PAGOS

Quiero que esta pantalla se base en la imagen de referencia de Mis pagos.

Objetivo de la sección

Aquí el cliente podrá consultar:

su próximo pago,

su saldo pendiente,

calendario de pagos,

pagos pendientes,

historial de pagos,

y recibos.

Encabezado

En la parte superior:

título: Mis pagos

subtítulo: Consulta tu calendario, historial y comprobantes

Resumen superior

Debajo del título, incluir dos tarjetas grandes:

Próximo pago

monto

fecha o aviso, por ejemplo: “vence hoy”

Saldo pendiente

total pendiente por pagar

Tabla / lista de pagos pendientes

Debajo, incluir una sección llamada Calendario de pagos o Pagos pendientes, con columnas como:

Fecha límite

Motivo

Monto

Estado

Acción

Ejemplos de motivos:

Apartado

Enganche

Mensualidad

Ejemplo de estados:

Pendiente

Atrasado

Por vencer

Cada fila debe tener un botón tipo:

Pagar ahora

Historial de pagos

Más abajo, una segunda tabla o lista llamada Pagos realizados con columnas como:

Fecha límite o fecha de pago

Motivo

Monto

Estado

Recibo

Cada fila debe tener un botón:

Ver recibo

Ese botón debe quedar preparado para abrir:

un PDF,

un modal,

o una futura vista de comprobante.

Por ahora puede abrir una pantalla placeholder o enlace ficticio.

Importante

Quiero distinguir visualmente:

pagos pendientes,

pagos atrasados,

pagos completados.

Usa etiquetas, texto en color o badges, pero mantén el estilo elegante y limpio.

Interacciones y navegación

Quiero que el prototipo o frontend generado tenga navegación entre secciones.

Navegación mínima requerida

Desde el menú lateral:

Home → Mis lotes

Home → Mis pagos

Mis lotes → Home

Mis pagos → Home

Botones y acciones

Los botones del Home deben ser clickeables.

Los botones del menú lateral deben navegar entre vistas.

Los botones de “Ver lotes”, “Ver ubicación”, “Pagar ahora”, “Ver recibo”, “Ver detalle” deben quedar visualmente listos y con rutas preparadas aunque por ahora usen datos ficticios.

Escalabilidad y preparación técnica

La estructura debe quedar pensada para crecer.

Quiero que el diseño/código quede preparado para:

conectar cada desarrollo a una base de datos,

conectar el botón Ver lotes con un mapa interactivo,

conectar el mapa a la base de datos,

mostrar lotes reales por cliente,

mostrar pagos reales por cliente,

conectar recibos,

permitir futuras secciones sin romper el diseño.

Organiza la información con componentes reutilizables

Usa componentes o bloques como:

sidebar

header

footer

card de desarrollo

card de lote

resumen KPI

tabla de pagos

botón principal

botón secundario

badge de estado

La idea es que después pueda editarse rápido y adaptarse al sistema real.

Datos ficticios realistas

Usa contenido ficticio pero creíble, por ejemplo:

Jonathan como usuario

desarrollos con nombres reales o similares a los de la referencia

montos como:

apartado: $2,000

enganche: $15,000

mensualidad: $2,400

recargo: $150

ubicaciones como Tonalá, Jalisco, México

Importante para el resultado

No hagas solo pantallas estáticas.
Quiero una propuesta de portal con estructura funcional, navegación y componentes bien organizados.

Debe verse listo para que después:

se conecte a backend,

se conecte al mapa,

se alimente con datos reales,

y se use para pruebas con clientes.

Primero enfócate en el portal del cliente con estas tres vistas:

Home

Mis lotes

Mis pagos

y deja preparado el espacio visual para la futura sección de Soporte y otras que vendrán después.