const normalize = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function uniqueOptions(cameras, key, fallback = "Todas") {
  const values = [...new Set(cameras.map((camera) => camera[key]).filter(Boolean))];
  return [fallback, ...values.sort((a, b) => a.localeCompare(b, "es"))];
}

export function getCatalogStats(cameras) {
  const countries = new Set(cameras.map((camera) => camera.country));
  const landscape = cameras.filter((camera) => camera.landscapeScore >= 90);
  return {
    total: cameras.length,
    countries: countries.size,
    landscape: landscape.length
  };
}

export function filterCameras(cameras, filters) {
  const query = normalize(filters.query);
  let result = cameras.filter((camera) => {
    const searchable = normalize([
      camera.title,
      camera.city,
      camera.country,
      camera.continent,
      camera.category,
      camera.provider,
      camera.tags?.join(" ")
    ].join(" "));

    const matchesQuery = !query || searchable.includes(query);
    const matchesContinent = filters.continent === "Todas" || camera.continent === filters.continent;
    const matchesCategory = filters.category === "Todas" || camera.category === filters.category;
    const matchesProvider = filters.provider === "Todos" || camera.provider === filters.provider;
    const matchesPriority = !filters.highPriorityOnly || camera.priority === "alta";

    return matchesQuery && matchesContinent && matchesCategory && matchesProvider && matchesPriority;
  });

  result.sort((a, b) => {
    if (filters.landscapeFirst) {
      return b.landscapeScore - a.landscapeScore || a.title.localeCompare(b.title, "es");
    }
    return a.title.localeCompare(b.title, "es");
  });

  return result;
}
