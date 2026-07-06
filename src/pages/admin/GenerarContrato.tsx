import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { ChevronLeft, Printer } from 'lucide-react'
import { numeroALetras } from '@/utils/helpers'

// ── Meses en español ──────────────────────────────────────────────────────
const MESES_ES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

// ── Plantilla HTML del contrato ───────────────────────────────────────────
// El contenido proviene de Contrato_Promesa_Compraventa_Pueblos_Barranca.html
// Las variables {{...}} son reemplazadas en tiempo de ejecución.
const TEMPLATE_HTML = `<p align="center" style="margin-right: 0in; margin-bottom: 0in; line-height: 100%">
<font face="Courier, sans-serif"><font size="4" style="font-size: 16pt"><b>CONTRATO
DE PROMESA DE COMPRAVENTA</b></font></font></p>
<p align="justify" style="line-height: 100%; margin-bottom: 0in"><br/>
</p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">En
la ciudad de Tonalá, Jalisco siendo el día </font></font><font color="#001d35"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>{{fecha_firma}}</b></font></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">,
ante la presencia de los testigos instrumentales que al final
suscriben este documento, comparecen por un lado los </font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>C.
GILBERTO ACOSTA MORAN, </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>GELUS
RUIZ CORONADO y TERESA</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">,
representados en este acto por conducto de su apoderado legal el </font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>C.</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">
</font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>ANGEL
OMAR RUIZ GAITAN</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">,
quien acredita su personalidad como apoderado mediante el instrumento
público </font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>(NO.
PODER)</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">
celebrado con fecha </font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>(FECHA
DE PODER)</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">
pasado ante la fe del Lic. </font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>(NOMBRE
DEL NOTARIO)</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">,
titular de la notaría </font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>(NUMERO
DE NOTARIA)</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">,
a quien en lo sucesivo se les denominará como </font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>"EL
PROMITENTE VENDEDOR"</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">,
comparece por otro lado el C. </font></font><font color="#001d35"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>{{cliente_nombre}}</b></font></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">,
a quien en lo sucesivo se le denominará como </font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>"EL
PROMITENTE COMPRADOR"</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">,
ambas partes en conjunto serán denominadas como </font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>"LAS
PARTES"</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">,
sujetos bajo el tenor de las siguientes:</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><br/>
</p>
<p align="center" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>DECLARACIONES:</b></font></font></p>
<p style="margin-right: 0in; margin-bottom: 0in"><br/>
</p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>A).-</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">
</font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>"EL
PROMITENTE VENDEDOR", ANGEL OMAR RUIZ GAITAN</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">,
manifiesta ser mexicano, mayor de edad, estado civil casado,
señalando como domicilio para oír y recibir todo tipo de
notificaciones, en la finca ubicada en Calle paseo Loma norte #7806
de la Municipalidad de Tonalá, Jalisco, con correo electrónico;
contacto@ruizinmobiliaria.com y número telefónico 3329543360.</font></font></p>
<p align="justify" style="margin-bottom: 0in; margin-right: 0in"><br/>
</p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>1).-
</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Que
no tiene conocimiento alguno sobre si</font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>
"EL PROMITENTE COMPRADOR" </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">se
encuentra o ha estado involucrado, directo e que establece la Ley
Federal De Extinción De Dominio, por lo que hasta donde es de su
conocimiento </font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>"EL
PROMITENTE COMPRADOR" </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">se
dedica exclusivamente a la realización de actividades lícitas. </font></font>
</p>
<p align="justify" style="margin-bottom: 0in; margin-right: 0in"><br/>
</p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>2).-
</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Que
al no conocer sobre la realización por parte de </font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>"EL
PROMITENTE COMPRADOR" </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">de
ninguno de los hechos ilícitos y delitos a los que refiere la Ley
Federal De Extinción De Dominio, actúa con absoluta buena fe en la
celebración de este contrato.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><br/>
</p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>B).-
"EL PROMITENTE COMPRADOR",</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">
</font></font><font color="#001d35"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>{{cliente_nombre}}</b></font></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">
manifiesta ser mexicano, mayor de edad, señalando como domicilio
para oír y recibir todo tipo de notificaciones, en la finca </font></font><font color="#001d35"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>{{cliente_domicilio}}</b></font></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">
con correo electrónico; </font></font><font color="#001d35"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>{{cliente_email}}</b></font></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">
y número telefónico </font></font><font color="#001d35"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>{{cliente_telefono}}</b></font></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">
que tributa bajo la clave de elector: </font></font><font color="#001d35"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>{{cliente_clave_elector}}</b></font></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">,
</font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>CURP:
</b></font></font><font color="#001d35"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>{{cliente_curp}}
</b></font></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">y
</font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>RFC</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">:
</font></font><font color="#001d35"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>{{cliente_rfc}}.</b></font></font></font></p>
<p align="justify" style="margin-bottom: 0in; margin-right: 0in"><br/>
</p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>1).-
</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Que
sus actividades jamás han incurrido en la comisión de delito
alguno, incluyendo los que establece la Ley Federal De Extinción De
Dominio.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><br/>
</p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>2).-
"EL PROMITENTE COMPRADOR",</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">
manifiesta que los recursos con los cuales se obliga a adquirir el
lote son de procedencia lícita, producto de actividades realizadas
dentro del marco de la Ley Federal para la Prevención e
Identificación de Operaciones con Recursos de Procedencia Ilícita
(en lo sucesivo la LFPIORPI), por lo que se obliga a proporcionar a
</font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>"EL
PROMITENTE VENDEDOR"</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">,
cualquier información que le sea requerida.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><br/>
</p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>3).-
"EL PROMITENTE VENDEDOR"</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">,
manifiesta que realizó la identificación de los comparecientes a
través de los documentos oficiales que exhibieron a la celebración
del presente documento, así como que ha dado cumplimiento a las
demás obligaciones que la (LFPIORPI), incluyendo requerir al cliente
o usuario la información sobre su actividad u ocupación, basándose
entre otros, en los avisos de inscripción y actualización de
actividades presentados para efectos del Registro Federal de
Contribuyentes. </font></font>
</p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Lo
anterior independientemente de los avisos y notificaciones
correspondientes que "EL PROMITENTE VENDEDOR" realizará
a las autoridades por el incumplimiento de "EL PROMITENTE COMPRADOR",
a la Ley Federal para la Prevención e identificación de Operaciones
con Recursos de Procedencia Ilícita. </font></font>
</p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><br/>
</p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>4).-</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">
En caso de que, por una causa atribuible a "EL PROMITENTE VENDEDOR",
exista en contra de "EL PROMITENTE COMPRADOR",
alguna sanción, prevención, apercibimiento, multa o contingencia
legal de cualquier índole derivado de incumplimientos a lo dispuesto
en la presente cláusula, "EL PROMITENTE VENDEDOR",
se obliga a responder solidariamente con ésta última para la debida
atención y/o solución de los rubros antes referidos. </font></font>
</p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><br/>
</p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Con
base en lo anterior y con fundamento en los artículos 8 de la
Constitución Política de los Estados Unidos Mexicanos, las partes
declaran celebrar el presente contrato de promesa de compraventa de
una fracción de lote rústico propiedad privada de conformidad a las
siguientes:</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><br/>
</p>
<p align="center" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>ANTECEDENTES
DE PROPIEDAD:</b></font></font></p>
<p style="margin-bottom: 0in; margin-right: 0in"><br/>
</p>
<p align="justify" style="margin-right: 0.25in; margin-bottom: 0in; line-height: 200%">
<font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>A).-</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">
El inmueble antes descrito fue adquirido por el señor ABRAHAM UGALDE
RAMIREZ, mediante la escritura pública número 5,673 cinco mil
seiscientos setenta y tres, de fecha 4 cuatro del mes de octubre del
año 1979 mil novecientos setenta y nueve ante la Fe del señor
Licenciado ANTONIO SÁNCHEZ ORTEGA, Notario Público número 7 siete
de la municipalidad de Guadalajara, Jalisco y debidamente registrada
bajo el folio Real número 18039 del Registro Público de la
Propiedad de la ciudad de Guadalajara, Jalisco. Y las señoras MARIA
CRISTINA MUÑOZ UGALDE Y MARIA ESTHER MUÑOZ UGALDE adquirieron el
bien inmueble mediante juicio sucesorio de los señores BENJAMIN
UGALDE RAMIREZ Y ABRAHAM UGALDE RAMÍREZ, con el número de
expediente 2029/2005 en el juzgado segundo de lo familiar del primer
partido judicial del Estado de Jalisco.</font></font></p>
<p align="justify" style="margin-right: 0.25in; margin-bottom: 0in; line-height: 200%">
<font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>B).-</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">
Mediante el cual se celebró un contrato de compraventa entre las
señoras MARIA CRISTINA MUÑOZ UGALDE Y MARIA ESTHER MUÑOZ UGALDE
realizando la venta del predio rústico ya mencionado en párrafos
anteriores, hacia el promitente comprador el señor ANGEL OMAR RUIZ
GAITAN.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><br/>
</p>
<p align="center" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>CLÁUSULAS:</b></font></font></p>
<p align="center" style="margin-bottom: 0in; margin-right: 0in"><br/>
</p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>---
PRIMERA.-</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">
"EL PROMITENTE VENDEDOR", promete vender a título oneroso un lote rústico propiedad privada de la
escritura Pública Número 5,673 cinco mil seiscientos setenta y
tres, citada en párrafos anteriores, ubicado en Puente Grande
municipio de Zapotlanejo Jalisco, con superficie de <b>6-95-66
seis hectáreas, noventa y cinco áreas, sesenta y seis centiáreas</b>,
libre de todo gravamen y al corriente en el pago y contribuciones,
comprometiéndose expresamente al saneamiento para el caso de
evicción del bien inmueble que es materia del presente contrato que
se describirá en el presente inciso y "EL PROMITENTE COMPRADOR", promete
comprar y en tal concepto va a recibir en perfectas condiciones de
uso y a su entera satisfacción, el siguiente bien inmueble:</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><br/>
</p>
<table cellpadding="7" cellspacing="0" style="width:100%; border-collapse:collapse; font-family:Courier,sans-serif; font-size:12pt;">
<tr style="background:#f2f2f2;"><td colspan="8" style="border:1px solid #000; padding:4px;">&nbsp;</td></tr>
<tr>
  <td style="border:1px solid #000; padding:4px;">Desarrollo</td>
  <td colspan="2" style="border:1px solid #000; padding:4px;">Pueblos de la Barranca</td>
  <td colspan="2" style="border:1px solid #000; padding:4px;">Manzana</td>
  <td style="border:1px solid #000; padding:4px;"><b>{{lote_manzana}}</b></td>
  <td style="border:1px solid #000; padding:4px;">Lote</td>
  <td style="border:1px solid #000; padding:4px;"><b>{{lote_numero}}</b></td>
</tr>
<tr>
  <td style="border:1px solid #000; padding:4px;">Superficie total</td>
  <td style="border:1px solid #000; padding:4px;"><b>{{lote_superficie}}</b> m2</td>
  <td colspan="2" style="border:1px solid #000; padding:4px;">Precio por m2</td>
  <td style="border:1px solid #000; padding:4px;">{{lote_precio_m2}}</td>
  <td colspan="2" style="border:1px solid #000; padding:4px;">Saldo Financiado</td>
  <td style="border:1px solid #000; padding:4px;">$<b>{{venta_saldo_financiado}}</b></td>
</tr>
</table>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><br/>
</p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>LOTE
{{lote_numero}} M{{lote_manzana}}
PROPIEDAD PRIVADA, TERRENO UBICADO MUNICIPIO DE ZAPOTLANEJO, JALISCO,
CON UNA SUPERFICIE APROXIMADA DE {{lote_superficie}} m2
METROS CUADRADOS, QUE MIDE Y LINDA:</b></font></font></p>
<p align="justify" style="margin-bottom: 0in; margin-right: 0in"><br/>
</p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>AL
NORTE: {{lote_lindero_norte}} METROS {{lote_colindancia_norte}}</b></font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>AL
SUR: {{lote_lindero_sur}} METROS {{lote_colindancia_sur}}</b></font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>AL
ESTE: {{lote_lindero_este}} METROS {{lote_colindancia_este}}</b></font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>AL
OESTE: {{lote_lindero_oeste}} METROS {{lote_colindancia_oeste}}</b></font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><br/>
</p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>---
SEGUNDA.- PRECIO.</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">
El precio de la Promesa de la Compraventa que ampara el presente
contrato por la cantidad <b>\${{venta_precio}}
({{venta_precio_letra}} PESOS 00/100 M.N.),</b> cantidad
que será cubierta por "EL PROMITENTE COMPRADOR" a "EL
PROMITENTE VENDEDOR" de la siguiente forma:</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><br/>
</p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>A).</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">-
El C. <b>{{cliente_nombre}}, "EL PROMITENTE COMPRADOR",</b>
ENTREGA a la firma del presente contrato la cantidad de <b>\${{venta_enganche}}
({{venta_enganche_letra}} PESOS 00/100 M.N.)</b>,
como anticipo del precio total de la operación de compraventa,
sirviendo también el presente contrato como el más amplio recibo
que en derecho corresponda. En caso de incumplimiento del pago
estipulado en el presente contrato se tomará este como nulo, y no
habrá devolución alguna</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>B).-</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">
El resto del precio, resultando la cantidad de <b>\${{venta_saldo_financiado}}
({{venta_saldo_financiado_letra}} PESOS 00/100 M.N.)</b>,
serán cubiertos por "EL PROMITENTE COMPRADOR",
en </font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font color="#001d35"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>{{venta_plazo}}</b></font></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">
</font></font><font color="#001d35"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>{{venta_plazo_letra}}</b></font></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">
pagos mensuales de </font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>$</b></font></font><font color="#001d35"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>{{venta_mensualidad}}</b></font></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">
</font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>(</b></font></font><font color="#001d35"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>{{venta_mensualidad_letra}}</b></font></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>
PESOS 00/100 M.N.) </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">de
manera consecutiva y a partir del próximo día 15 QUINCE del mes de
</font></font><font color="#001d35"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">{{venta_mes_primera_mensualidad}}</font></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">
del año en curso hasta completar en número de mensualidades
pactadas y completar el precio acordado por las partes, (Anexo de
documentos corridas de pagaré 2da hoja).</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Las
Partes entienden y están de acuerdo que en el presente Contrato es
un contrato de promesa de compraventa. Las entregas de dinero que se
hacen conforme al presente contrato, se hacen como depósitos en
garantía del cumplimiento de la obligación de pago de precio al
momento de celebrarlo.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>---
TERCERA.- </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Las
mensualidades acordadas, deberán ser pagadas por "EL PROMITENTE COMPRADOR"
a "EL PROMITENTE VENDEDOR"
El día 15 QUINCE de cada mes que corresponda, con fecha límite de
pago, el día 20 VEINTE del mes que corresponda, los pagos se
realizarán en efectivo en el domicilio ubicado en la calle <b>PASEO
LOMA NORTE #7806, LOMA DORADA, TONALÁ, JALISCO RUIZ INMOBILIARIA,</b>
los días hábiles de lunes a viernes, en un horario de 09:00 AM a 06:30 PM.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>---
CUARTA.- </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">En
caso de mora en el pago de una o más mensualidades ya sea de manera
consecutiva o alterna, en los términos de la Cláusula <u><b>SEGUNDA</b></u> de
este contrato, por el pago fuera de tiempo y forma que este acuerdo
bilateral establece, generará un cargo a "EL PROMITENTE COMPRADOR",
a partir del día siguiente del término establecido en este contrato.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">El
interés moratorio será exigible a partir del día 21 VEINTIUNO de
cada mes correspondiente, a razón de $150.00(ciento cincuenta pesos
M.N. 00/100) semanales por lote, hasta que se realice el pago
correspondiente, si fuera el caso en el que "EL PROMITENTE COMPRADOR",
acumule un término de <b>03 TRES meses</b> esto de manera consecutiva o intercalados,
sin haber pagado la mensualidad establecida en este contrato, en términos del artículo
<b>1784 del Código Civil del Estado de Jalisco</b>
será acreedor "EL PROMITENTE COMPRADOR"
a la rescisión del contrato objeto del negocio jurídico con sus
consecuencias legales que a Derecho corresponden.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>---
QUINTA.- </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Queda
estrictamente prohibido que "EL PROMITENTE COMPRADOR"
CEDA, TRASPASE O VENDA PARCIALMENTE O TODO o de alguna otra manera
los derechos y obligaciones que adquiere mediante el Contrato, sin el
consentimiento previo de "EL PROMITENTE VENDEDOR"
dado por escrito, mismo que deberá estar sellado, firmado y
autorizado por "EL PROMITENTE VENDEDOR", además
de estar al corriente de pago de sus mensualidad y conceptos de
cuotas, y en caso contrario de no dar aviso con antelación sin
previa autorización, dará motivo a que se le dé inmediatamente por
rescindido con anticipación a su vencimiento el presente contrato,
con las consecuencias legales correspondientes que sería una pena
del 25% veinticinco por ciento del valor total del presente acto jurídico.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">En
caso que "EL PROMITENTE COMPRADOR"
lleve a cabo la cesión, traspaso o venda, deberá pagar a "EL PROMITENTE VENDEDOR"
por gastos administrativos una pena de $4,000.00 (cuatro mil pesos
00/100 Moneda Nacional). Dicho pago deberá realizarse a la cuenta
bancaria que para tal efecto señale "EL PROMITENTE VENDEDOR",
no será reembolsable y no se considerará como parte del Precio.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>---
SEXTA.- "EL PROMITENTE COMPRADOR"</b>
en caso de rescindir de manera voluntaria el presente contrato, sin
que por ello incurra en alguna causa de rescisión, será acreedor a
una pena del valor equivalente por el <b>20% veinte por ciento</b> del
total de la operación pactada en el presente acto jurídico, además
de tener la obligación de dar aviso por escrito a "EL PROMITENTE VENDEDOR"
con 01 UNO mes de antelación.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>---
SÉPTIMA.- </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Expresamente
los contratantes pactan, que serán causas de rescisión del presente
contrato, las siguientes:</font></font></p>
<ol type="a">
<li><p>Vender, traspasar, o ceder de manera parcial o total, respecto del "INMUEBLE" materia del presente contrato, sin consentimiento de "EL PROMITENTE VENDEDOR".</p></li>
<li><p>El depósito tardío de 03 TRES o más depósitos del Precio del bien inmueble conforme a las mensualidades pactadas en los días establecidos con anterioridad, consecutivos o no.</p></li>
<li><p>El incumplimiento de cualquier otra cláusula y obligación a cargo de "EL PROMITENTE COMPRADOR" en este Contrato.</p></li>
<li><p>Guardar en la finca de forma dolosa, sustancias peligrosas, explosivas o inflamables que amenacen la seguridad del bien inmueble, así como tener animales en la misma o material o cosas o sustancias de procedencia ilícita.</p></li>
<li><p>Que se lleven a cabo actividades de procedencia ilícita de forma dolosa dentro del bien inmueble.</p></li>
<li><p>La falsedad de cualquiera de sus declaraciones en las secciones A y B de este Contrato.</p></li>
</ol>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>---
OCTAVA.- </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Al momento en que opere la rescisión del presente Contrato, el BIEN INMUEBLE quedará automática y completamente liberado para todos los efectos legales a que haya lugar, pudiendo "EL PROMITENTE VENDEDOR" desde ese momento disponer del bien inmueble plenamente, incluyendo para su comercialización a terceros, sin responsabilidad legal alguna.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>--- NOVENA.- </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">El Inmueble materia de este contrato pasará a la parte adquirente libre de todo gravamen, al corriente en el pago del Impuesto predial, servicios de agua, plusvalías y contribuciones, obligándose "EL PROMITENTE VENDEDOR", al saneamiento para el caso de evicción.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>--- DÉCIMA.-</b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"> "EL PROMITENTE COMPRADOR" deberá solicitar la autorización para construir, modificar o hacer cualquier actividad de obra en el inmueble materia del presente contrato, de la misma forma cualquier modificación, adhesión o construcción que se hubiera realizado en el predio, no se realizará reembolso alguno, ya que ambas partes aceptan de común acuerdo, que de realizarse cualquiera de estas adecuaciones, quedarán a favor de "EL PROMITENTE VENDEDOR" juntó todas sus acciones y derechos, por concepto de pena, según la cláusula cuarta del mismo contrato.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Cualquier construcción que se inicie en donde no esté autorizada una licencia de construcción o anterior a la cobertura del monto pactado en esta cláusula y sea motivo a una multa, esta será a cuenta de "EL PROMITENTE COMPRADOR".</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Así mismo "EL PROMITENTE VENDEDOR" ofrecerá todas las facilidades ante las autoridades correspondientes para tramitar licencias necesarias para la construcción en el predio antes mencionado.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>--- DÉCIMA PRIMERA.- </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Si "EL PROMITENTE COMPRADOR" realiza cualquier tipo de construcción, modificación o cualquier actividad de obra, sin autorización elaborado por escrito, firmada y sellada por parte de "EL PROMITENTE VENDEDOR", "EL PROMITENTE COMPRADOR" será acreedor a una pena equivalente al 30% treinta por ciento de la operación total del presente acto, además tendrá que cubrir en su totalidad cualquier multa, clausura o incremento de impuesto que por su actuar afecte al bien inmueble.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in; line-height: 150%"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>--- DÉCIMA SEGUNDA.- </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">El Contrato de compra-venta se formalizará en escritura pública, una vez que "EL PROMITENTE COMPRADOR" haya cumplido con la totalidad de sus obligaciones bajo este contrato. "EL PROMITENTE VENDEDOR" notificará a "EL PROMITENTE COMPRADOR" que ya se encuentra con la capacidad jurídica y total para realizar la compraventa formal ante el notario público del bien inmueble ya antes mencionado. Dicha notificación se entregará por vía electrónica <b>{{cliente_email}}</b>; o por correo certificado al domicilio de "EL PROMITENTE COMPRADOR" que anexo en el apartado de declaraciones del presente contrato.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in; line-height: 150%"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>--- DÉCIMA TERCERA.- </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Los gastos, derechos, impuestos y honorarios que se causen por la Escritura de <b>COMPRA VENTA</b> serán pagados por "EL PROMITENTE COMPRADOR", misma que se hará en la Notaría de su preferencia.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>--- DÉCIMA CUARTA.- </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Los accesos sobre el predio antes mencionado corren a cargo de "EL PROMITENTE VENDEDOR" para tener acceso al predio adquirido y más adelante se convierta en las calles y/o vialidad, así como el alineamiento esto con la finalidad de dar certeza jurídica sobre el mismo, una vez que se obtenga por parte de las autoridades administrativas y/o judiciales respectivas, en el entendido que la introducción de servicios públicos o las cuotas se establecerán conforme al plan de regularización y al plan de desarrollo urbano del municipio.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>--- DÉCIMA QUINTA.- </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Caso fortuito o fuerza mayor. "EL PROMITENTE VENDEDOR" quedará liberado de sus obligaciones, no tendrán ningún tipo de responsabilidad y no estarán obligados a pagar pena alguna, frente a "EL PROMITENTE COMPRADOR" o terceros, de forma no limitativa, respecto a daños, perjuicios, incumplimientos y obligaciones originados o relacionados con algún supuesto de caso fortuito o fuerza mayor y por orden o prohibición emanada de alguna autoridad y/o entidad pública o privada. Lo anterior, respecto al Contrato, bien inmueble y el Proyecto denominado "<b>PUEBLOS DE LA BARRANCA</b>".</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Las Partes acuerdan considerar como otros supuestos de caso fortuito o fuerza mayor los siguientes: disposiciones oficiales que eviten el cumplimiento del presente Contrato por "EL PROMITENTE VENDEDOR", tales como pandemias, enfermedades graves pandémicas que por dicha razón haya un cierre total parcial de las actividades laborales y de los sectores aplicables al presente, publicaciones en el Periódico Oficial del Estado de Jalisco y en el Diario Oficial de la Federación que eviten el cumplimiento de este Contrato por "EL PROMITENTE VENDEDOR", causas naturales, desastres naturales, terremotos, lluvias fuertes, epidemias, pandemias, inundaciones, invasiones, hechos o actos ajenos a "EL PROMITENTE VENDEDOR" que impida tener plenamente la posesión.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">El incumplimiento por parte de "EL PROMITENTE COMPRADOR" que tenga origen o relación con su solvencia económica y financiera no será considerado como un caso fortuito o fuerza mayor y, por ende, no es considerado un excluyente de responsabilidad.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>--- DÉCIMA SEXTA.- </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Las partes contratantes consideran que lo pactado en este documento es justo y legítimo, haciéndose sabedores de la situación del inmueble, objeto material del presente contrato, por lo tanto, renuncian a las acciones de nulidad, error o lesión que señala el Código Civil del Estado de Jalisco, así como acciones de índole Penal que establezca el Código Penal para el estado de Jalisco.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>--- DÉCIMA SÉPTIMA.- </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">El contenido y los efectos del presente documento gozan de validez y plena producción de sus efectos jurídicos puesto que forman parte de un acuerdo integral de voluntades entre las Partes, cada una de las Partes manifiesta su consentimiento por persona capaz, no existe ningún vicio del consentimiento en su celebración, cuenta con un objeto posible, su objeto, motivo y fin son lícitos y su contenido es apegado a la ley, no transgrede el orden público y se conduce conforme a la moral y a las buenas costumbres.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>--- DÉCIMA OCTAVA.- "EL PROMITENTE COMPRADOR", </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">nombra como su beneficiario en caso de muerte al C. <b>{{cliente_beneficiario}}</b>, quien podrá continuar con los pagos parciales de dicho lote anteriormente especificado, hasta la liquidación del mismo.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>--- DÉCIMA NOVENA.- LEYES DE EXTINCIÓN DE DOMINIO EN MATERIA LOCAL Y FEDERAL</b>. Las partes, de conformidad con lo manifestado en el capítulo de declaraciones, ratifican que el presente contrato es celebrado de buena fe, por lo que "EL PROMITENTE COMPRADOR" libera a "EL PROMITENTE VENDEDOR" de toda responsabilidad penal en la que pudiera verse involucrado, derivado de la comisión de cualquier delito consumado dentro o fuera del inmueble referido (hechos típicos y antijurídicos) relacionados con la delincuencia organizada, delitos fiscales de otros tipos ilícitos que se mencionan de manera enunciativa mas no limitada los siguientes: narcotráfico, secuestro, robo de vehículo, trata de personas o cualquier otro contenido en la Ley de Extinción de dominio de la legislación penal.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>--- VIGÉSIMA.- </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Las partes manifiestan que si alguna da lugar a trámites extrajudiciales o judiciales, con intervención de abogados, aún en gestiones privadas por la falta de cumplimiento a sus obligaciones contraídas en el contrato y por violaciones a las cláusulas que lo forman en cualquier sentido, la parte responsable se hará cargo de los gastos, costas y se obliga a cubrir los honorarios del abogado de la parte afectada, a razón del pago del importe equivalente a tres mensualidades, además de aquellos honorarios que fije al efecto los tribunales que conozcan en su momento del litigio Judicial, y por ese concepto se condene en la sentencia respectiva.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>--- VIGÉSIMA PRIMERA.- </b></font></font><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Para la interpretación y cumplimiento de este Contrato, así como para el ejercicio de cualquier acción judicial derivada del mismo, "EL PROMITENTE VENDEDOR" y "EL PROMITENTE COMPRADOR", considerarán como aplicables, en lo conducente, la legislación Civil aplicable en los Estados Unidos Mexicanos y competencia de los Tribunales competentes del Estado de Jalisco, con cabecera en la zona metropolitana de Guadalajara, Jalisco, y renuncian a cualquier fuero que pudiera corresponderles, en razón de sus domicilios presentes o futuros.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Las PARTES contratantes, incluso si en lo futuro cambiarán su nacionalidad mexicana por alguna extranjera, renuncian expresamente a invocar la protección y a hacer valer la aplicación de cualquier ley, reglamento, decreto, acuerdo o disposición legal, de cualquier índole, distinta de las precisadas en el párrafo pre-VENDEDOR.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><br/>
</p>
<p align="center" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>CLÁUSULA OBLIGATORIA DE SERVICIOS:</b></font></font></p>
<p align="center" style="margin-bottom: 0in; margin-right: 0in"><br/>
</p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">En cuanto a la mejora del proyecto se va a realizar a mediano plazo. Se proyecta de la siguiente manera en dos años se iniciará con la licitación para cada servicio a partir de ahí se dividirá en mensualidades y a mitad de financiamiento de los mismos se iniciarán los trabajos correspondientes para que cuando se finiquite el financiamiento de servicios también se termine la obra.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Una vez iniciado el cobro de servicios unido a las mensualidades es obligatorio el pago para no afectar los avances de la obra y a su vez no afectar a los demás propietarios por demorar los trabajos debido a ese incumplimiento.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">En el caso de incumplimiento del pago de servicios no habrá una penalización, sino que se tomará de las mismas mensualidades siguientes para cubrir el pago de los servicios que así sea necesario queda implícito con ello que al llegar al incumplimiento del pago de las mensualidades se aplicará la cláusula de rescisión de contrato por incumplimiento de pago.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt">Llegado el momento de iniciar el financiamiento de los servicios se implementará un contrato especial con ese fin que será un anexo a este contrato de promesa de compraventa.</font></font></p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0in"><br/><br/><br/>
</p>
<p align="justify" style="margin-right: 0in; margin-bottom: 0.06in"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><u><b>Leído que fue en voz alta el contenido del presente contrato a los que en el intervinieron, y bien enterados de su alcance y contenido, se manifestaron conformes con el mismo y lo ratifican y firman ante la presencia de los testigos que firman al calce para constancia.</b></u></font></font></p>
<p><br/><br/><br/>
</p>
<p align="center"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>TONALÁ, JALISCO A {{contrato_dia}} DE {{contrato_mes}} DEL AÑO {{contrato_anio}}.</b></font></font></p>
<p><br/><br/><br/>
</p>
<p align="center"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>____________________________________________</b><br/>
C. ANGEL OMAR RUIZ GAITAN<br/>
"EL PROMITENTE VENDEDOR"</font></font></p>
<p><br/><br/><br/>
</p>
<p align="center"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>____________________________________________</b><br/>
<br/>
C. {{cliente_nombre}}<br/>
"EL PROMITENTE COMPRADOR"</font></font></p>
<p><br/><br/><br/>
</p>
<p align="center"><font face="Courier, sans-serif"><font size="3" style="font-size: 12pt"><b>___________________________&nbsp;&nbsp;&nbsp;&nbsp;___________________________</b><br/>
<br/>
TESTIGO 1&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;TESTIGO 2</font></font></p>`

// ── Sustitución de variables ──────────────────────────────────────────────
function reemplazarVariables(template: string, vars: Record<string, string | undefined>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value ?? '')
  }
  return result
}

function formatearMonto(n: number | null | undefined): string {
  if (n == null) return '0.00'
  return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

// ── Componente principal ──────────────────────────────────────────────────
export const GenerarContrato = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [htmlContrato, setHtmlContrato] = useState<string>('')
  const [variablesFaltantes, setVariablesFaltantes] = useState<string[]>([])
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return

    const cargarDatos = async () => {
      setLoading(true)
      setError(null)
      try {
        // 1. Cargar venta
        const { data: ventaData, error: ventaErr } = await supabase
          .from('venta')
          .select('*')
          .eq('ventaid', id)
          .single()
        if (ventaErr || !ventaData) throw new Error('No se encontró la venta.')

        // 2. Cargar cliente
        const { data: clienteData, error: clienteErr } = await supabase
          .from('cliente')
          .select('*')
          .eq('clienteid', ventaData.clienteid)
          .single()
        if (clienteErr || !clienteData) throw new Error('No se encontró el cliente.')

        // 3. Cargar lote con desarrollo
        const { data: loteData, error: loteErr } = await supabase
          .from('lote')
          .select('*, desarrollo:desarrollo(*)')
          .eq('loteid', ventaData.loteid)
          .single()
        if (loteErr || !loteData) throw new Error('No se encontró el lote.')

        // 4. Calcular variables
        const saldoFinanciado = (ventaData.preciolote || 0) - (ventaData.enganche || 0)
        const hoy = new Date()

        // Mes de primera mensualidad (con fallback robusto a fecha inválida)
        const primeraFechaDate = ventaData.fechaprimeramensualidad
          ? new Date(ventaData.fechaprimeramensualidad + 'T12:00:00')
          : null
        const mesPrimera = (primeraFechaDate && !isNaN(primeraFechaDate.getTime()))
          ? (MESES_ES[primeraFechaDate.getMonth()] ?? '')
          : ''

        // Fecha de firma (fechacontrato o hoy; con fallback si la fecha almacenada es inválida)
        const fechaContratoBruta = ventaData.fechacontrato
          ? new Date(ventaData.fechacontrato + 'T12:00:00')
          : null
        const fechaFirmaDate = (fechaContratoBruta && !isNaN(fechaContratoBruta.getTime()))
          ? fechaContratoBruta
          : hoy
        const fechaFirma = fechaFirmaDate
          .toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
          .toUpperCase()

        // Domicilio del cliente
        const domicilioParts = [
          clienteData.calle,
          clienteData.numeroext ? `#${clienteData.numeroext}` : null,
          clienteData.colonia,
          clienteData.municipio_ciudad,
          clienteData.estado,
        ].filter(Boolean)
        const domicilioCliente = domicilioParts.length > 0
          ? domicilioParts.join(', ')
          : (clienteData.domiciliocobro || '')

        const vars: Record<string, string> = {
          fecha_firma: fechaFirma,
          cliente_nombre: (clienteData.nombre || '').toUpperCase(),
          cliente_email: clienteData.email || '',
          cliente_telefono: clienteData.telefonocelular || '',
          cliente_domicilio: domicilioCliente,
          cliente_clave_elector: clienteData.claveelector || '',
          cliente_curp: clienteData.curp || '',
          cliente_rfc: clienteData.rfc || '',
          cliente_beneficiario: (clienteData.beneficiarios || '').toUpperCase(),
          lote_manzana: loteData.manzana || '',
          lote_numero: loteData.nolote || '',
          lote_superficie: loteData.superficie != null ? String(loteData.superficie) : '',
          lote_precio_m2: loteData.preciopormt2 != null ? formatearMonto(loteData.preciopormt2) : '',
          lote_lindero_norte: loteData.linderonte != null ? String(loteData.linderonte) : '',
          lote_colindancia_norte: loteData.colindanciante || '',
          lote_lindero_sur: loteData.linderosur != null ? String(loteData.linderosur) : '',
          lote_colindancia_sur: loteData.colindanciasur || '',
          lote_lindero_este: loteData.linderoote != null ? String(loteData.linderoote) : '',
          lote_colindancia_este: loteData.colindanciaote || '',
          lote_lindero_oeste: loteData.linderopte != null ? String(loteData.linderopte) : '',
          lote_colindancia_oeste: loteData.colindanciapte || '',
          venta_precio: formatearMonto(ventaData.preciolote),
          venta_precio_letra: numeroALetras(ventaData.preciolote),
          venta_enganche: formatearMonto(ventaData.enganche),
          venta_enganche_letra: numeroALetras(ventaData.enganche),
          venta_saldo_financiado: formatearMonto(saldoFinanciado),
          venta_saldo_financiado_letra: numeroALetras(saldoFinanciado),
          venta_mensualidad: formatearMonto(ventaData.mensualidad),
          venta_mensualidad_letra: numeroALetras(ventaData.mensualidad),
          venta_plazo: ventaData.plazo != null ? String(ventaData.plazo) : '',
          venta_plazo_letra: numeroALetras(ventaData.plazo),
          venta_mes_primera_mensualidad: mesPrimera,
          contrato_dia: String(hoy.getDate()),
          contrato_mes: MESES_ES[hoy.getMonth()],
          contrato_anio: String(hoy.getFullYear()),
        }

        // 5. Reemplazar variables
        const html = reemplazarVariables(TEMPLATE_HTML, vars)

        // 6. Detectar variables sin reemplazar
        const faltantes = [...html.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1])
        setVariablesFaltantes([...new Set(faltantes)])
        setHtmlContrato(html)
      } catch (err: any) {
        setError(err.message || 'Error al cargar el contrato.')
      } finally {
        setLoading(false)
      }
    }

    cargarDatos()
  }, [id])

  const handleImprimir = () => {
    const ventana = window.open('', '_blank', 'width=900,height=700')
    if (!ventana) return
    ventana.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Contrato de Promesa de Compraventa - Venta #${id}</title>
  <style>
    body { font-family: Courier, monospace; font-size: 12pt; margin: 2cm; line-height: 1.4; }
    @page { margin: 2cm; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid #000; padding: 4px 8px; }
    p { margin-bottom: 6pt; }
    ol { margin-left: 20px; }
  </style>
</head>
<body>${htmlContrato}</body>
</html>`)
    ventana.document.close()
    ventana.focus()
    ventana.print()
  }

  return (
    <AdminLayout>
      <div className="w-full max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate(`/admin/ventas/${id}`)}
            className="inline-flex items-center gap-2"
          >
            <ChevronLeft size={20} />
            Volver a Venta #{id}
          </Button>
          {!loading && !error && (
            <Button
              onClick={handleImprimir}
              className="inline-flex items-center gap-2"
            >
              <Printer size={16} />
              Imprimir / Guardar PDF
            </Button>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Contrato de Promesa de Compraventa — Venta #{id}
        </h1>

        {/* Alerta de variables faltantes */}
        {variablesFaltantes.length > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">Variables sin datos en el contrato:</p>
            <ul className="list-disc list-inside">
              {variablesFaltantes.map(v => <li key={v}><code>{`{{${v}}}`}</code></li>)}
            </ul>
            <p className="mt-2 text-xs">Revisa que el cliente y el lote tengan todos los datos completos.</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin">
                <div className="h-8 w-8 border-4 border-[#eaae4c] border-t-transparent rounded-full"></div>
              </div>
              <p className="mt-4 text-gray-500">Cargando contrato...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div
            ref={previewRef}
            className="bg-white border border-gray-200 rounded-lg shadow p-10"
            style={{ fontFamily: 'Courier, monospace', fontSize: '12pt', lineHeight: '1.5' }}
            dangerouslySetInnerHTML={{ __html: htmlContrato }}
          />
        )}
      </div>
    </AdminLayout>
  )
}
