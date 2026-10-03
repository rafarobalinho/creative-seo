// País e idioma da Consulta de marca. A base de menções do DataForSEO tem o
// Google AI Overview do Brasil em português (8,57 milhões de respostas,
// conferido em 2026-10-03 no endpoint locations_and_languages). O ChatGPT dessa
// base só existe nos EUA, em inglês, e o servidor já força isso sozinho
// (CHATGPT_LOCATION_CODE). O original pedia EUA e inglês para as duas.
export const LOCAL_CONSULTA_MARCA = {
  locationCode: 2076,
  languageCode: "pt",
} as const;
