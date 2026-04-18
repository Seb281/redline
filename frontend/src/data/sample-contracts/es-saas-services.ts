/**
 * SP-2 — Sample Spanish B2B SaaS services agreement for the demo.
 *
 * Spanish jurisdiction with explicit governing-law clause so Pass 0 returns
 * source_type="stated", country="ES". Drafted to exercise several ES catalog
 * entries plus EU-wide citations.
 *
 * SP-2 statute coverage:
 *   - ES_CC_1256 (unilateral arbitrio) → §4 unilateral price revision,
 *     §5 unilateral SLA modifications
 *   - ES_CC_1124 (right to terminate on breach) → §7 clause that tries to
 *     limit the client's resolution remedy to service credits only
 *   - ES_CC_1258 (good-faith integration) → §8 audit rights with 24h notice
 *     and penalty for refusal — gotcha-style enforcement
 *   - ES_CC_1255 (public-order limit on autonomía) → §10 blanket waiver of
 *     Spanish consumer/labor protections "to the fullest extent permitted"
 *   - EU_GDPR → §9 processor obligations (incomplete Art. 28 coverage)
 *   - EU_DIR_93_13_EEC → §7 unfair-terms logic applies via national practice
 *
 * The contract is adhesive in tone (boilerplate favoring the Provider),
 * giving the analyzer a realistic B2B SaaS target for ES-law review.
 */

import type { UploadResponse } from "@/types";

export const ES_SAAS_SERVICES_TEXT = `\
CONTRATO DE PRESTACIÓN DE SERVICIOS SaaS

Entre las partes:

Servios Cloud Ibérica, S.L., sociedad de responsabilidad limitada constituida \
conforme al Derecho español, con NIF B-87654321 e inscrita en el Registro \
Mercantil de Madrid, Tomo 32.451, Folio 182, Hoja M-584.921, con domicilio \
social en Calle Velázquez 150, 28002 Madrid, representada por D. Alejandro \
Navarro Ruiz en calidad de Administrador Único (en adelante, "el Proveedor"),

y

Manufacturas del Norte, S.A., sociedad anónima con NIF A-62159847, con \
domicilio social en Avenida Diagonal 477, 08036 Barcelona, representada por \
Dña. Carmen Soler Ferrer en calidad de Consejera Delegada (en adelante, "el \
Cliente"),

CONVIENEN CELEBRAR EL PRESENTE CONTRATO DE PRESTACIÓN DE SERVICIOS SaaS, QUE \
SE REGIRÁ POR LAS SIGUIENTES CLÁUSULAS:

CLÁUSULA 1ª — OBJETO

El Proveedor pondrá a disposición del Cliente la plataforma "Iberia Logistics \
Cloud" en modalidad Software-as-a-Service, accesible en la URL \
https://app.iberialogistics.es, conforme a las especificaciones técnicas que \
constan en el Anexo I.

CLÁUSULA 2ª — DURACIÓN

El presente contrato tendrá una duración inicial de treinta y seis (36) meses \
contados desde la fecha de firma, prorrogándose tácitamente por períodos \
anuales salvo denuncia expresa comunicada por escrito con una antelación \
mínima de seis (6) meses a la fecha de vencimiento.

CLÁUSULA 3ª — PRECIO

El Cliente abonará al Proveedor una cuota mensual de doce mil euros \
(12.000 €), más el IVA correspondiente, mediante domiciliación bancaria en la \
cuenta designada por el Proveedor.

CLÁUSULA 4ª — REVISIÓN UNILATERAL DE PRECIOS

El Proveedor podrá revisar unilateralmente y a su entera discreción la cuota \
mensual mediante preaviso de treinta (30) días, sin que el Cliente tenga \
derecho a oposición ni a resolución anticipada del contrato por tal motivo. \
No se aplicarán índices externos, fórmulas objetivas ni topes máximos a \
dicha revisión.

CLÁUSULA 5ª — NIVEL DE SERVICIO Y MODIFICACIONES

(1) El Proveedor se compromete a mantener una disponibilidad mensual del \
noventa y nueve por ciento (99%) medida sobre base calendario.

(2) El Proveedor se reserva el derecho a modificar, reducir o sustituir \
funcionalidades de la plataforma, así como las métricas y umbrales del SLA, \
en cualquier momento y sin necesidad de acuerdo previo con el Cliente.

(3) El incumplimiento del SLA mensual dará derecho al Cliente a un crédito \
máximo equivalente al cinco por ciento (5%) de la cuota del mes afectado, \
quedando expresamente excluida cualquier otra reclamación de daños y \
perjuicios.

CLÁUSULA 6ª — LIMITACIÓN DE RESPONSABILIDAD

La responsabilidad agregada del Proveedor por cualquier causa, contractual o \
extracontractual, queda limitada al importe efectivamente abonado por el \
Cliente en los tres (3) meses inmediatamente anteriores al hecho generador. \
En ningún caso el Proveedor responderá por lucro cesante, daños indirectos, \
pérdida de datos o pérdida de oportunidades de negocio.

CLÁUSULA 7ª — INCUMPLIMIENTO Y REMEDIO EXCLUSIVO

En caso de incumplimiento del Proveedor, incluido el incumplimiento reiterado \
de los niveles de servicio, el único remedio a disposición del Cliente \
consistirá en los créditos de servicio previstos en la cláusula 5ª(3), \
renunciando expresamente el Cliente a la facultad de resolución del contrato \
por incumplimiento y a la reclamación de cualesquiera otros daños. Esta \
renuncia se aplicará con independencia de la gravedad o reiteración del \
incumplimiento.

CLÁUSULA 8ª — AUDITORÍA

(1) El Proveedor podrá auditar el uso de la plataforma por parte del Cliente \
en cualquier momento, con un preaviso de veinticuatro (24) horas.

(2) El Cliente facilitará acceso inmediato a sus instalaciones, sistemas y \
documentación. La negativa o demora en facilitar dicho acceso se considerará \
incumplimiento grave y dará lugar a una penalización de diez mil euros \
(10.000 €) por día de retraso, así como a la facultad del Proveedor de \
suspender el servicio sin preaviso adicional.

CLÁUSULA 9ª — PROTECCIÓN DE DATOS

(1) El Proveedor tratará los datos personales del Cliente en calidad de \
encargado del tratamiento, conforme al Reglamento (UE) 2016/679 (RGPD) y a \
la Ley Orgánica 3/2018, de Protección de Datos Personales y garantía de los \
derechos digitales.

(2) El Cliente autoriza al Proveedor a recurrir a subencargados sin necesidad \
de notificación ni aprobación previa, quedando bajo la exclusiva \
responsabilidad del Proveedor su selección y control.

(3) En caso de quiebra de seguridad, el Proveedor notificará al Cliente tan \
pronto como sea razonablemente posible, sin sujetarse a los plazos \
establecidos en el artículo 33 del RGPD.

CLÁUSULA 10ª — RENUNCIA DE DERECHOS

El Cliente renuncia, en la máxima medida permitida por la legislación \
aplicable, a cualesquiera derechos y remedios derivados de la normativa \
española de consumidores y usuarios, de la normativa laboral aplicable a su \
personal que acceda a la plataforma, y de cualquier otra norma imperativa \
nacional o autonómica que pudiera resultar de aplicación al presente \
contrato.

CLÁUSULA 11ª — LEGISLACIÓN APLICABLE Y JURISDICCIÓN

Las partes someten el presente contrato a la legislación española. Para la \
resolución de cuantas cuestiones, diferencias o discrepancias pudieran \
derivarse de la interpretación, cumplimiento o ejecución del presente \
contrato, las partes, con renuncia expresa a cualquier otro fuero que \
pudiera corresponderles, se someten a los Juzgados y Tribunales de la ciudad \
de Madrid.

CLÁUSULA 12ª — MISCELÁNEA

12.1 Integridad. El presente contrato y sus anexos constituyen el acuerdo \
íntegro entre las partes y sustituyen cualesquiera acuerdos previos, verbales \
o escritos, sobre su objeto.

12.2 Divisibilidad. La nulidad o ineficacia de cualquier cláusula no afectará \
a la validez del resto del contrato.

Y en prueba de conformidad, ambas partes firman el presente contrato por \
duplicado en el lugar y fecha indicados a continuación.

Madrid, 18 de abril de 2026.

Por el Proveedor                          Por el Cliente
Alejandro Navarro Ruiz                    Carmen Soler Ferrer
Administrador Único                       Consejera Delegada`;

export const ES_SAAS_SERVICES_UPLOAD: UploadResponse = {
  filename: "contrato-saas-es.pdf",
  file_type: "pdf",
  page_count: 5,
  extracted_text: ES_SAAS_SERVICES_TEXT,
  char_count: ES_SAAS_SERVICES_TEXT.length,
  text_source: "native",
};
