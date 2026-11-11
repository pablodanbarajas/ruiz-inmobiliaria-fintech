import { Download } from 'lucide-react';
import { AVISO_PRIVACIDAD } from '../../config/privacidad';

// Text of JU-FO-001 REV 0 as delivered by Ruiz. The paper form's date and
// signature lines are left out: in the portal, consent is the checkbox at
// sign-up, recorded with the date and this version.

const finalidadesPrimarias = [
  'Identificarle y contactarle por los medios de comunicación que haya proporcionado.',
  'Validar y/o verificar su información y autenticar su identidad.',
  'Realizar los trámites y/o gestiones necesarias relacionados con la apertura de su contrato.',
  'Registro, gestión, control y administración de clientes.',
  'Gestión de expedientes con información relacionada a su persona.',
  'Gestión, control, procesamiento y recepción de pagos.',
  'Dar respuesta a sus dudas, comentarios y/o proporcionarle la información que solicite.',
  'Gestión del canal de Atención al Cliente para darlo de alta y proporcionar seguimiento a quejas, sugerencias, dudas, aclaraciones de algún servicio y/o producto que haya adquirido anteriormente.',
  'Realizar los trámites necesarios para concretar y formalizar la compra-venta del (los) inmueble(s), ante las autoridades, instituciones financieras y fedatarios públicos correspondientes.',
  'Realizar transacciones con instituciones de crédito, que resulten con motivo de la relación jurídica correspondiente.',
  'Gestión de trámites para la obtención de créditos y/o financiamientos a favor de usted, respecto a la adquisición de inmuebles.',
  'Para corroborar las referencias personales, bancarias y/o comerciales que usted haya proporcionado.',
  'Cumplimiento de las normativas sectoriales, o bien, para atender requerimientos de autoridades competentes.',
  'Para realizar las negociaciones relacionadas con la celebración y/o firma de contratos y convenios de reconocimiento de adeudo.',
  'Asegurar el cumplimiento de obligaciones de confidencialidad, inexistencia de conflictos de interés, honorabilidad, transparencia y anticorrupción; así como de disposiciones legales sobre prevención de lavado de dinero y otras actividades ilícitas. Del mismo modo, todas las figuras que la Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita prevé.',
  'Regulación del acceso físico a las instalaciones de RUIZ INMOBILIARIA.',
  'Contacto a sus familiares, dependientes económicos y/o beneficiarios.',
  'Estadística y registro histórico de clientes.',
];

const finalidadesSecundarias = [
  'Efectuar comunicaciones sobre actividades de RUIZ INMOBILIARIA y/o de empresas con Nexo patrimonial con RUIZ INMOBILIARIA que operan bajo las mismas políticas internas en materia de protección de datos personales, a través de reconocimientos, felicitaciones, invitaciones a eventos, torneos, exhibiciones, colectas, donaciones y cualquier otra comunicación corporativa asociada a usos de carácter social.',
  'Envío de comunicaciones comerciales, publicitarias, promocionales e informativas, con relación de los servicios y productos que comercializa RUIZ INMOBILIARIA, o marcas, productos y servicios que comercializan nuestros socios comerciales. Tales comunicaciones incluyen el envío de correos electrónicos, SMS, llamadas telefónicas, y otras formas de comunicación electrónica o postal.',
  'Levantamiento de encuestas de satisfacción, hábitos de consumo y/o estudios para mejora de nuestros servicios.',
];

const Titulo = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-base font-semibold text-gray-900 mt-6 mb-2">{children}</h2>
);

export function AvisoPrivacidad() {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 md:p-8 text-sm text-gray-700 leading-relaxed">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Aviso de Privacidad Integral</h1>
            <p className="text-gray-500">Para acreditados y usuarios · {AVISO_PRIVACIDAD.version}</p>
          </div>
          <a
            href={AVISO_PRIVACIDAD.pdfHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-teal-700 text-teal-700 hover:bg-teal-50 px-3 py-2 text-sm font-medium whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Descargar PDF
          </a>
        </div>

        <p>
          En cumplimiento a lo dispuesto por la Ley Federal de Protección de Datos Personales en Posesión de los
          Particulares (en adelante, la Ley), su Reglamento y demás normatividad aplicable en la materia, ponemos a su
          disposición en el presente Aviso de Privacidad la existencia y características principales del tratamiento al
          que serán sometidos sus datos personales, con el objeto de que usted pueda ejercer sus derechos a la
          autodeterminación informativa, privacidad y protección de datos personales.
        </p>

        <Titulo>Identidad y domicilio del responsable</Titulo>
        <p>
          “OTRU ASOCIADOS S.A. DE C.V.”, a quien para efectos del presente documento se le denominará como RUIZ
          INMOBILIARIA, es el responsable del tratamiento de sus datos personales. Con domicilio en la calle Paseo Loma
          Norte Número 7806, Colonia Loma Dorada, Código Postal 45402, Municipio de Tonalá, Estado de Jalisco, México.
        </p>

        <Titulo>Datos personales que recaba el responsable</Titulo>
        <p>
          Para cumplir las finalidades previstas en el presente Aviso de Privacidad, RUIZ INMOBILIARIA recabará las
          categorías de datos personales que a continuación señalamos:
        </p>
        <ol className="list-decimal pl-6 mt-2 space-y-1">
          <li>Datos de identificación;</li>
          <li>Datos de contacto;</li>
          <li>Datos de autenticación;</li>
          <li>Datos laborales;</li>
        </ol>

        <Titulo>Sobre datos personales sensibles</Titulo>
        <p>
          RUIZ INMOBILIARIA no recaba datos personales sensibles para las finalidades que se describen en el presente
          Aviso de Privacidad. En caso de que debamos solicitar este tipo de información de carácter personal sensible,
          recabaremos su consentimiento expreso y por escrito, a través de los medios físicos o electrónicos
          correspondientes.
        </p>

        <Titulo>Finalidades del Tratamiento de sus Datos Personales</Titulo>
        <p>
          Tratamos sus datos personales para dos tipos de finalidades: primarias y secundarias. En ese sentido, RUIZ
          INMOBILIARIA tratará sus datos personales para las siguientes FINALIDADES PRIMARIAS:
        </p>
        <ol className="list-decimal pl-6 mt-2 space-y-1">
          {finalidadesPrimarias.map((texto) => <li key={texto}>{texto}</li>)}
        </ol>
        <p className="mt-3">
          De manera adicional, si Usted no ha manifestado su oposición, RUIZ INMOBILIARIA podrá tratar sus datos
          personales para las siguientes FINALIDADES SECUNDARIAS:
        </p>
        <ol className="list-decimal pl-6 mt-2 space-y-1">
          {finalidadesSecundarias.map((texto) => <li key={texto}>{texto}</li>)}
        </ol>

        <Titulo>Derechos ARCO y/o revocación del consentimiento para el tratamiento de sus datos personales</Titulo>
        <p>
          En todos los casos legalmente procedentes, usted o su representante legal, podrá ejercer cualquiera de los
          Derechos de Acceso, Rectificación, Cancelación y Oposición (en lo sucesivo, Derechos ARCO), así como a
          Revocar su Consentimiento para el tratamiento o transferencia de sus datos personales, por lo que en
          cualquier momento podrá enviar una solicitud a nuestro Departamento de Protección de Datos Personales a
          través del siguiente correo electrónico:{' '}
          <a href="mailto:gemaruizinmobiliaria@gmail.com" className="text-teal-700 hover:underline">
            gemaruizinmobiliaria@gmail.com
          </a>
          , o bien podrá presentarla personalmente al domicilio ubicado en la calle Paseo Loma Norte Número 7806,
          Colonia Loma Dorada, Código Postal. 45402, Municipio de Tonalá, Estado de Jalisco, México.
        </p>
        <p className="mt-3">
          Asimismo, le informamos que para que su solicitud proceda es indispensable completar toda la información que
          prevé capítulo III de la Ley Federal de Protección de Datos Personales en Posesión de Particulares.
        </p>

        <Titulo>Modificaciones y actualizaciones</Titulo>
        <p>
          El presente Aviso de Privacidad puede sufrir modificaciones, cambios o actualizaciones derivadas de nuevos
          requerimientos legales; de nuestras propias necesidades por los servicios que ofrecemos; de nuestras
          prácticas de privacidad; de cambios en nuestro modelo de negocio, por lo que RUIZ INMOBILIARIA se compromete
          a mantenerlo informado sobre los cambios que pueda sufrir el presente Aviso de Privacidad.
        </p>
        <p className="mt-3">
          Asimismo, Usted podrá solicitar en todo momento este documento al Departamento de Protección de Datos
          Personales de RUIZ INMOBILIARIA a la cuenta de correo electrónico:{' '}
          <a href="mailto:gemaruizinmobiliaria@gmail.com" className="text-teal-700 hover:underline">
            gemaruizinmobiliaria@gmail.com
          </a>
        </p>

        <Titulo>Consentimiento</Titulo>
        <p>
          Con su respectiva firma Usted manifiesta que conoce el contenido, alcance, términos y condiciones del
          presente Aviso de Privacidad y que consiente de manera expresa y por escrito el tratamiento al que serán
          sometidos sus Datos Personales.
        </p>
        <p className="mt-3 text-gray-500">
          En el portal, su aceptación queda registrada al marcar la casilla correspondiente al crear su cuenta o su
          contraseña, junto con la fecha y la versión de este aviso.
        </p>
      </div>
    </div>
  );
}
