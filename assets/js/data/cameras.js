// Catálogo inicial compacto.
// Cada línea representa una referencia candidata de cámara en directo.
// En futuras versiones se puede sustituir sourceUrl por el enlace oficial verificado
// y embedUrl por la URL de iframe estable cuando el proveedor lo permita.

export const CATALOG_META = {
  version: '1.0.0',
  updatedAt: '2026-06-09',
  description: 'Catálogo inicial de webcams públicas organizado para GitHub Pages.'
};

const seed = `Times Square|Nueva York|Estados Unidos|América del Norte|Urbana|EarthCam|ciudad,noche,icono,plaza|96
Empire State Building|Nueva York|Estados Unidos|América del Norte|Urbana|EarthCam|skyline,ciudad,rascacielos|91
Estatua de la Libertad|Nueva York|Estados Unidos|América del Norte|Monumento|EarthCam|monumento,bahía,skyline|92
Puente de Brooklyn|Nueva York|Estados Unidos|América del Norte|Urbana|EarthCam|puente,ciudad,río|87
Abbey Road|Londres|Reino Unido|Europa|Urbana|EarthCam|ciudad,música,calle|80
Temple Bar|Dublín|Irlanda|Europa|Urbana|EarthCam|ciudad,calle,cultura|83
Las Vegas Strip|Las Vegas|Estados Unidos|América del Norte|Urbana|EarthCam|ciudad,noche,neones|86
Hollywood Boulevard|Los Ángeles|Estados Unidos|América del Norte|Urbana|EarthCam|ciudad,calle,cine|79
Bourbon Street|Nueva Orleans|Estados Unidos|América del Norte|Urbana|EarthCam|ciudad,calle,música|78
Miami Beach|Miami|Estados Unidos|América del Norte|Costa|EarthCam|playa,costa,paisaje|95
Duval Street / Key West|Key West|Estados Unidos|América del Norte|Costa|EarthCam|costa,calle,isla|82
Clearwater Beach|Clearwater|Estados Unidos|América del Norte|Costa|EarthCam|playa,costa,paisaje|94
St. Pete Beach|St. Pete Beach|Estados Unidos|América del Norte|Costa|EarthCam|playa,costa,paisaje|93
Gran Cañón|Arizona|Estados Unidos|América del Norte|Naturaleza|EarthCam|cañón,naturaleza,paisaje|98
Cataratas del Niágara|Niagara Falls|Canadá|América del Norte|Naturaleza|EarthCam|catarata,agua,paisaje|97
Mount Rushmore|Dakota del Sur|Estados Unidos|América del Norte|Monumento|EarthCam|monumento,montaña|85
Space Needle|Seattle|Estados Unidos|América del Norte|Urbana|EarthCam|skyline,ciudad,bahía|88
Bahía de San Francisco|San Francisco|Estados Unidos|América del Norte|Costa|EarthCam|bahía,skyline,paisaje|90
Washington Monument|Washington D.C.|Estados Unidos|América del Norte|Monumento|EarthCam|monumento,ciudad|86
Boston Harbor|Boston|Estados Unidos|América del Norte|Costa|EarthCam|puerto,skyline,costa|84
Fontana di Trevi|Roma|Italia|Europa|Monumento|SkylineWebcams|monumento,ciudad,historia|89
Coliseo|Roma|Italia|Europa|Monumento|SkylineWebcams|monumento,historia,ciudad|88
Plaza de España|Roma|Italia|Europa|Urbana|SkylineWebcams|plaza,ciudad,historia|84
Plaza de San Pedro|Ciudad del Vaticano|Vaticano|Europa|Monumento|SkylineWebcams|monumento,plaza,historia|87
Puente de Rialto|Venecia|Italia|Europa|Costa|SkylineWebcams|canal,ciudad,historia|93
Bacino di San Marco|Venecia|Italia|Europa|Costa|SkylineWebcams|canal,laguna,paisaje|94
Duomo de Milán|Milán|Italia|Europa|Monumento|SkylineWebcams|monumento,plaza,ciudad|86
Arena de Verona|Verona|Italia|Europa|Monumento|SkylineWebcams|anfiteatro,historia,ciudad|82
Ponte Vecchio|Florencia|Italia|Europa|Urbana|SkylineWebcams|río,ciudad,historia|86
Torre de Pisa|Pisa|Italia|Europa|Monumento|SkylineWebcams|monumento,historia|81
Nápoles y Vesubio|Nápoles|Italia|Europa|Costa|SkylineWebcams|volcán,bahía,paisaje|95
Positano|Costa Amalfitana|Italia|Europa|Costa|SkylineWebcams|costa,pueblo,paisaje|98
Amalfi|Costa Amalfitana|Italia|Europa|Costa|SkylineWebcams|costa,pueblo,paisaje|96
Marina Grande|Capri|Italia|Europa|Costa|SkylineWebcams|isla,puerto,paisaje|94
Taormina|Sicilia|Italia|Europa|Costa|SkylineWebcams|costa,historia,paisaje|95
Etna|Sicilia|Italia|Europa|Volcán|SkylineWebcams|volcán,montaña,paisaje|99
Palermo|Sicilia|Italia|Europa|Costa|SkylineWebcams|ciudad,costa,puerto|84
Cagliari|Cerdeña|Italia|Europa|Costa|SkylineWebcams|costa,puerto,ciudad|85
Bormio|Lombardía|Italia|Europa|Montaña|SkylineWebcams|montaña,nieve,paisaje|95
Livigno|Alpes Italianos|Italia|Europa|Montaña|SkylineWebcams|montaña,nieve,paisaje|96
Barceloneta|Barcelona|España|Europa|Costa|WebcamTaxi|playa,ciudad,costa|95
Sagrada Família|Barcelona|España|Europa|Monumento|WebcamTaxi|monumento,ciudad|88
Gran Vía|Madrid|España|Europa|Urbana|WebcamTaxi|ciudad,calle,noche|82
Benidorm Levante|Benidorm|España|Europa|Costa|WebcamTaxi|playa,costa,skyline|94
Puerto de Málaga|Málaga|España|Europa|Costa|WebcamTaxi|puerto,costa,ciudad|88
Los Cristianos|Tenerife|España|Europa|Costa|WebcamTaxi|isla,playa,paisaje|95
Maspalomas|Gran Canaria|España|Europa|Costa|WebcamTaxi|dunas,playa,paisaje|96
Playa Blanca|Lanzarote|España|Europa|Costa|WebcamTaxi|isla,mar,paisaje|93
Puerto de Ibiza|Ibiza|España|Europa|Costa|WebcamTaxi|isla,puerto,costa|87
Palma de Mallorca|Mallorca|España|Europa|Costa|WebcamTaxi|ciudad,costa,puerto|86
Torre Eiffel|París|Francia|Europa|Monumento|WebcamTaxi|monumento,ciudad|89
París panorámica|París|Francia|Europa|Urbana|WebcamTaxi|skyline,ciudad|84
Promenade des Anglais|Niza|Francia|Europa|Costa|WebcamTaxi|costa,playa,ciudad|92
Mont Saint-Michel|Normandía|Francia|Europa|Monumento|WebcamTaxi|monumento,marea,paisaje|96
Chamonix Mont-Blanc|Chamonix|Francia|Europa|Montaña|WebcamTaxi|montaña,nieve,paisaje|98
Matterhorn|Zermatt|Suiza|Europa|Montaña|WebcamTaxi|montaña,alpes,paisaje|99
Lago de Lucerna|Lucerna|Suiza|Europa|Costa|WebcamTaxi|lago,ciudad,paisaje|91
Amsterdam Dam Square|Ámsterdam|Países Bajos|Europa|Urbana|WebcamTaxi|plaza,ciudad|82
Puente Erasmus|Róterdam|Países Bajos|Europa|Urbana|WebcamTaxi|puente,skyline,río|87
Grote Markt|Brujas|Bélgica|Europa|Urbana|WebcamTaxi|plaza,historia|83
Plaza de la Ciudad Vieja|Praga|Chequia|Europa|Urbana|WebcamTaxi|plaza,historia,ciudad|86
Ópera de Viena|Viena|Austria|Europa|Urbana|WebcamTaxi|ciudad,cultura|80
Innsbruck Alpes|Innsbruck|Austria|Europa|Montaña|WebcamTaxi|montaña,ciudad,paisaje|93
Puerta de Brandeburgo|Berlín|Alemania|Europa|Monumento|WebcamTaxi|monumento,ciudad|82
Puerto de Hamburgo|Hamburgo|Alemania|Europa|Costa|WebcamTaxi|puerto,río,ciudad|88
Nyhavn|Copenhague|Dinamarca|Europa|Costa|WebcamTaxi|canal,ciudad,color|88
Estocolmo panorámica|Estocolmo|Suecia|Europa|Costa|WebcamTaxi|archipiélago,ciudad,costa|89
Bergen puerto|Bergen|Noruega|Europa|Costa|WebcamTaxi|fiordo,puerto,paisaje|91
Lofoten|Nordland|Noruega|Europa|Naturaleza|WebcamTaxi|islas,montaña,aurora|98
Reikiavik|Reikiavik|Islandia|Europa|Costa|WebcamTaxi|costa,ciudad,paisaje|87
Vík í Mýrdal|Vík|Islandia|Europa|Naturaleza|WebcamTaxi|playa negra,acantilado,paisaje|96
Acrópolis|Atenas|Grecia|Europa|Monumento|WebcamTaxi|monumento,historia,ciudad|88
Santorini caldera|Santorini|Grecia|Europa|Costa|WebcamTaxi|isla,caldera,paisaje|99
Mykonos puerto|Mykonos|Grecia|Europa|Costa|WebcamTaxi|isla,mar,costa|93
Bósforo|Estambul|Turquía|Europa/Asia|Costa|WebcamTaxi|estrecho,ciudad,puente|92
Dubrovnik|Dubrovnik|Croacia|Europa|Costa|WebcamTaxi|muralla,costa,historia|93
Split Riva|Split|Croacia|Europa|Costa|WebcamTaxi|puerto,costa,ciudad|87
Praça do Comércio|Lisboa|Portugal|Europa|Costa|WebcamTaxi|plaza,río,ciudad|86
Ribeira|Oporto|Portugal|Europa|Costa|WebcamTaxi|río,ciudad,puente|88
Funchal|Madeira|Portugal|Europa|Costa|WebcamTaxi|isla,puerto,paisaje|92
Ponta Delgada|Azores|Portugal|Europa|Costa|WebcamTaxi|isla,puerto,atlántico|89
Cruce de Shibuya|Tokio|Japón|Asia|Urbana|WebcamTaxi|ciudad,cruce,noche|90
Tokyo Skytree|Tokio|Japón|Asia|Urbana|WebcamTaxi|skyline,ciudad|88
Kioto|Kioto|Japón|Asia|Urbana|WebcamTaxi|templo,ciudad,historia|83
Monte Fuji|Yamanashi|Japón|Asia|Montaña|WebcamTaxi|montaña,volcán,paisaje|99
Seúl panorámica|Seúl|Corea del Sur|Asia|Urbana|WebcamTaxi|skyline,ciudad|83
Victoria Harbour|Hong Kong|China|Asia|Costa|WebcamTaxi|skyline,puerto,noche|94
Marina Bay|Singapur|Singapur|Asia|Costa|WebcamTaxi|skyline,bahía,ciudad|92
Bangkok skyline|Bangkok|Tailandia|Asia|Urbana|WebcamTaxi|ciudad,río|80
Patong Beach|Phuket|Tailandia|Asia|Costa|WebcamTaxi|playa,isla,paisaje|93
Kuta Beach|Bali|Indonesia|Asia|Costa|WebcamTaxi|playa,surf,isla|94
Maldivas resort|Maldivas|Maldivas|Asia|Costa|WebcamTaxi|isla,laguna,paisaje|98
Dubai Marina|Dubái|EAU|Asia|Costa|WebcamTaxi|skyline,marina,ciudad|90
Burj Khalifa|Dubái|EAU|Asia|Urbana|WebcamTaxi|rascacielos,ciudad|87
Jerusalén|Jerusalén|Israel|Asia|Monumento|WebcamTaxi|historia,ciudad|82
Sydney Harbour|Sídney|Australia|Oceanía|Costa|WebcamTaxi|bahía,ópera,skyline|94
Bondi Beach|Sídney|Australia|Oceanía|Costa|WebcamTaxi|playa,surf,paisaje|95
Melbourne skyline|Melbourne|Australia|Oceanía|Urbana|WebcamTaxi|skyline,ciudad|82
Gold Coast|Queensland|Australia|Oceanía|Costa|WebcamTaxi|playa,skyline,surf|94
Auckland Harbour|Auckland|Nueva Zelanda|Oceanía|Costa|WebcamTaxi|puerto,skyline,costa|89`;

const slugify = (value) => value.toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const priorityFromScore = (score) => score >= 90 ? 'alta' : score >= 82 ? 'media' : 'normal';

export const CAMERAS = seed.trim().split('\n').map((line, index) => {
  const [title, city, country, continent, category, provider, tagsRaw, scoreRaw] = line.split('|');
  const landscapeScore = Number(scoreRaw);
  const query = encodeURIComponent(`${provider} ${title} ${city} ${country} live webcam`);

  return {
    id: `${slugify(title)}-${slugify(city)}-${index + 1}`,
    title,
    city,
    country,
    continent,
    category,
    provider,
    sourceType: 'public-search',
    sourceUrl: `https://www.youtube.com/results?search_query=${query}`,
    embedUrl: null,
    latitude: 0,
    longitude: 0,
    tags: tagsRaw.split(',').filter(Boolean),
    landscapeScore,
    priority: priorityFromScore(landscapeScore),
    embeddable: false,
    notes: 'Referencia inicial. Verificar URL final y embedUrl antes de marcarla como cámara embebible estable.'
  };
});
