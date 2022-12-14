"use strict";

/** Helper function to generate a Google Maps directions URL */
function generateDirectionsURL(origin, destination) {
  const googleMapsUrlBase = "https://www.google.com/maps/dir/?";
  const searchParams = new URLSearchParams("api=1");
  searchParams.append("origin", origin);
  const destinationParam = [];
  // Add title to destinationParam except in cases where Quick Builder set
  // the title to the first line of the address
  if (destination.title !== destination.address1) {
    destinationParam.push(destination.title);
  }
  destinationParam.push(destination.address1, destination.address2);
  searchParams.append("destination", destinationParam.join(","));
  return googleMapsUrlBase + searchParams.toString();
}

// alert(locator.locations[locationIdx].title);
// Get the modal
var modal = document.getElementById("myModal");

// Get the button that opens the modal

// Get the <span> element that closes the modal
var span = document.getElementsByClassName("close")[0];

// When the user clicks on <span> (x), close the modal
span.onclick = function () {
  modal.style.display = "none";
};

/**
 * Defines an instance of the Locator+ solution, to be instantiated
 * when the Maps library is loaded.
 */
function LocatorPlus(configuration) {
  const locator = this;

  locator.locations = configuration.locations || [];
  locator.capabilities = configuration.capabilities || {};

  const mapEl = document.getElementById("gmp-map");
  const panelEl = document.getElementById("locations-panel");
  locator.panelListEl = document.getElementById("locations-panel-list");
  const sectionNameEl = document.getElementById(
    "location-results-section-name"
  );
  const resultsContainerEl = document.getElementById("location-results-list");

  const itemsTemplate = Handlebars.compile(
    document.getElementById("locator-result-items-tmpl").innerHTML
  );

  locator.searchLocation = null;
  locator.searchLocationMarker = null;
  locator.selectedLocationIdx = null;
  locator.userCountry = null;

  // Initialize the map -------------------------------------------------------
  locator.map = new google.maps.Map(mapEl, configuration.mapOptions);

  // Store selection.
  const selectResultItem = function (locationIdx, panToMarker, scrollToResult) {
    console.log(locator.locations[locationIdx].title);
    locator.selectedLocationIdx = locationIdx;
    for (let locationElem of resultsContainerEl.children) {
      locationElem.classList.remove("selected");
      if (getResultIndex(locationElem) === locator.selectedLocationIdx) {
        locationElem.classList.add("selected");
        if (scrollToResult) {
          panelEl.scrollTop = locationElem.offsetTop;
        }
      }
    }
    if (panToMarker && locationIdx != null) {
      locator.map.panTo(locator.locations[locationIdx].coords);
    }

    var textModal = document.getElementById("text-modal");

    textModal.innerHTML =
      "<h3>" +
      locator.locations[locationIdx].title +
      " - " +
      locator.locations[locationIdx].cantPersonas +
      " Personas" +
      "</h3>" +
      "<br>";
    textModal.innerHTML += locator.locations[locationIdx].address1 + "<br/>";
    textModal.innerHTML +=
      locator.locations[locationIdx].cantVentanilla +
      " en ventanilla (12 minutos de espera) <br/>";
    textModal.innerHTML +=
      locator.locations[locationIdx].cantPlataforma +
      " en plataforma (20 minutos de espera) <br/>";

    // When the user clicks the button, open the modal
    modal.style.display = "block";

    // mostrarModal();
  };

  //Mostrar Modal
  // const mostrarModal = function (data) {

  // }

  // Create a marker for each location.
  const markers = locator.locations.map(function (location, index) {
    const marker = new google.maps.Marker({
      position: location.coords,
      map: locator.map,
      title: location.title,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 16,
        fillColor:
          location.estado == 0
            ? "#08a500"
            : location.estado == 1
            ? "#de8000"
            : "#e80700",
        fillOpacity: 1,
        strokeOpacity: 0,
      },
    });
    marker.addListener("click", function () {
      selectResultItem(index, false, true);
    });
    return marker;
  });

  // Fit map to marker bounds.
  locator.updateBounds = function () {
    const bounds = new google.maps.LatLngBounds();
    if (locator.searchLocationMarker) {
      bounds.extend(locator.searchLocationMarker.getPosition());
    }
    for (let i = 0; i < markers.length; i++) {
      bounds.extend(markers[i].getPosition());
    }
    locator.map.fitBounds(bounds);
  };
  if (locator.locations.length) {
    locator.updateBounds();
  }

  // Get the distance of a store location to the user's location,
  // used in sorting the list.
  const getLocationDistance = function (location) {
    if (!locator.searchLocation) return null;

    // Use travel distance if available (from Distance Matrix).
    if (location.travelDistanceValue != null) {
      return location.travelDistanceValue;
    }

    // Fall back to straight-line distance.
    return google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(location.coords),
      locator.searchLocation.location
    );
  };

  // Render the results list --------------------------------------------------
  const getResultIndex = function (elem) {
    return parseInt(elem.getAttribute("data-location-index"));
  };

  locator.renderResultsList = function () {
    let locations = locator.locations.slice();
    for (let i = 0; i < locations.length; i++) {
      locations[i].index = i;
    }
    if (locator.searchLocation) {
      sectionNameEl.textContent = "Oficinas (" + locations.length + ")";
      locations.sort(function (a, b) {
        return getLocationDistance(a) - getLocationDistance(b);
      });
    } else {
      sectionNameEl.textContent = `Oficinas (${locations.length})`;
    }
    const resultItemContext = { locations: locations };
    resultsContainerEl.innerHTML = itemsTemplate(resultItemContext);
    for (let item of resultsContainerEl.children) {
      const resultIndex = getResultIndex(item);
      if (resultIndex === locator.selectedLocationIdx) {
        item.classList.add("selected");
      }

      const resultSelectionHandler = function () {
        if (resultIndex !== locator.selectedLocationIdx) {
          selectResultItem(resultIndex, true, false);
        }
      };

      // Clicking anywhere on the item selects this location.
      // Additionally, create a button element to make this behavior
      // accessible under tab navigation.
      item.addEventListener("click", resultSelectionHandler);
      item
        .querySelector(".select-location")
        .addEventListener("click", function (e) {
          resultSelectionHandler();
          e.stopPropagation();
        });

      // Clicking the directions button will open Google Maps directions in a
      // new tab
      const origin =
        locator.searchLocation != null ? locator.searchLocation.location : "";
      const destination = locator.locations[resultIndex];
      const googleMapsUrl = generateDirectionsURL(origin, destination);
      item
        .querySelector(".directions-button")
        .setAttribute("href", googleMapsUrl);
    }
  };

  // Optional capability initialization --------------------------------------
  initializeSearchInput(locator);
  initializeDistanceMatrix(locator);

  // Initial render of results -----------------------------------------------
  locator.renderResultsList();
}

/** When the search input capability is enabled, initialize it. */
function initializeSearchInput(locator) {
  const geocodeCache = new Map();
  const geocoder = new google.maps.Geocoder();

  const searchInputEl = document.getElementById("location-search-input");
  const searchButtonEl = document.getElementById("location-search-button");

  const updateSearchLocation = function (address, location) {
    if (locator.searchLocationMarker) {
      locator.searchLocationMarker.setMap(null);
    }
    if (!location) {
      locator.searchLocation = null;
      return;
    }
    locator.searchLocation = { address: address, location: location };
    locator.searchLocationMarker = new google.maps.Marker({
      position: location,
      map: locator.map,
      title: "My location",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: "#000000",
        fillOpacity: 0.5,
        strokeOpacity: 0,
      },
    });

    // Update the locator's idea of the user's country, used for units. Use
    // `formatted_address` instead of the more structured `address_components`
    // to avoid an additional billed call.
    const addressParts = address.split(" ");
    locator.userCountry = addressParts[addressParts.length - 1];

    // Update map bounds to include the new location marker.
    locator.updateBounds();

    // Update the result list so we can sort it by proximity.
    locator.renderResultsList();

    locator.updateTravelTimes();
  };

  const geocodeSearch = function (query) {
    if (!query) {
      return;
    }

    const handleResult = function (geocodeResult) {
      searchInputEl.value = geocodeResult.formatted_address;
      updateSearchLocation(
        geocodeResult.formatted_address,
        geocodeResult.geometry.location
      );
    };

    if (geocodeCache.has(query)) {
      handleResult(geocodeCache.get(query));
      return;
    }
    const request = { address: query, bounds: locator.map.getBounds() };
    geocoder.geocode(request, function (results, status) {
      if (status === "OK") {
        if (results.length > 0) {
          const result = results[0];
          geocodeCache.set(query, result);
          handleResult(result);
        }
      }
    });
  };

  // Set up geocoding on the search input.
  searchButtonEl.addEventListener("click", function () {
    console.log("buscador");
    geocodeSearch(searchInputEl.value.trim());
  });

  // Initialize Autocomplete.
  initializeSearchInputAutocomplete(
    locator,
    searchInputEl,
    geocodeSearch,
    updateSearchLocation
  );
}

/** Add Autocomplete to the search input. */
function initializeSearchInputAutocomplete(
  locator,
  searchInputEl,
  fallbackSearch,
  searchLocationUpdater
) {
  // Set up Autocomplete on the search input. Bias results to map viewport.
  const autocomplete = new google.maps.places.Autocomplete(searchInputEl, {
    types: ["geocode"],
    fields: ["place_id", "formatted_address", "geometry.location"],
  });
  autocomplete.bindTo("bounds", locator.map);
  autocomplete.addListener("place_changed", function () {
    const placeResult = autocomplete.getPlace();
    if (!placeResult.geometry) {
      // Hitting 'Enter' without selecting a suggestion will result in a
      // placeResult with only the text input value as the 'name' field.
      fallbackSearch(placeResult.name);
      return;
    }
    searchLocationUpdater(
      placeResult.formatted_address,
      placeResult.geometry.location
    );
  });
}

/** Initialize Distance Matrix for the locator. */
function initializeDistanceMatrix(locator) {
  const distanceMatrixService = new google.maps.DistanceMatrixService();

  // Annotate travel times to the selected location using Distance Matrix.
  locator.updateTravelTimes = function () {
    if (!locator.searchLocation) return;

    const units =
      locator.userCountry === "USA"
        ? google.maps.UnitSystem.IMPERIAL
        : google.maps.UnitSystem.METRIC;
    const request = {
      origins: [locator.searchLocation.location],
      destinations: locator.locations.map(function (x) {
        return x.coords;
      }),
      travelMode: google.maps.TravelMode.DRIVING,
      unitSystem: units,
    };
    const callback = function (response, status) {
      if (status === "OK") {
        const distances = response.rows[0].elements;
        for (let i = 0; i < distances.length; i++) {
          const distResult = distances[i];
          let travelDistanceText, travelDistanceValue;
          if (distResult.status === "OK") {
            travelDistanceText = distResult.distance.text;
            travelDistanceValue = distResult.distance.value;
          }
          const location = locator.locations[i];
          location.travelDistanceText = travelDistanceText;
          location.travelDistanceValue = travelDistanceValue;
        }

        // Re-render the results list, in case the ordering has changed.
        locator.renderResultsList();
      }
    };
    distanceMatrixService.getDistanceMatrix(request, callback);
  };
}

const CONFIGURATION = {
  locations: [],
  mapOptions: {
    center: { lat: 0, lng: 0 },
    fullscreenControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    zoom: 4,
    zoomControl: true,
    maxZoom: 17,
    mapId: "",
  },
  mapsApiKey: "AIzaSyDLYqdXo3At5Bw32j0EC4cNZaMQuKOpj90",
  capabilities: {
    input: true,
    autocomplete: true,
    directions: false,
    distanceMatrix: true,
    details: false,
    actions: false,
  },
};

function consult() {
  console.log("consultando");
  fetch("https://retoolapi.dev/FhUVHv/data", {
    method: "GET",
    headers: {
      "Content-type": "application/json; charset=UTF-8",
    },
  })
    .then((response) => response.json())
    .then((responseData) => {
      CONFIGURATION.locations = [];
      for (const d of bancos) {
        CONFIGURATION.locations.push({
          id: d.id,
          estado: d.estado,
          title: d.nombre,
          address1: d.direccion,
          cantPersonas: d.aforoActual,
          cantPlataforma: d.esperaPlataforma,
          cantVentanilla: d.esperaVentanilla,
          coords: {
            lat: d.latOficina,
            lng: d.longOficina,
          },
        });
      }

      new LocatorPlus(CONFIGURATION);
    })
    .catch((error) => console.warn(error));
}

const bancos = [
  {
    id: 1,
    nombre: "CAMINO REAL",
    direccion: "AV. CAMINO REAL 355",
    idEstado: 0,
    idProvincia: 0,
    idPais: 0,
    aforoTotal: 50,
    aforoActual: 35,
    estado: 1,
    esperaPlataforma: 15,
    esperaVentanilla: 20,
    latOficina: -12.097156393531519,
    longOficina: -77.03612165197502,
  },
  {
    id: 2,
    nombre: "C.C. SAN ISIDRO",
    direccion: "AV. RIVERA NAVARRETE N?? 815",
    idEstado: 0,
    idProvincia: 0,
    idPais: 0,
    aforoTotal: 60,
    aforoActual: 30,
    estado: 0,
    esperaPlataforma: 6,
    esperaVentanilla: 24,
    latOficina: -12.095092312802052,
    longOficina: -77.02618734492259,
  },
  {
    id: 6,
    nombre: "JORGE BASADRE",
    direccion: "JORGE BASADRE 487",
    idEstado: 0,
    idProvincia: 0,
    idPais: 0,
    aforoTotal: 20,
    aforoActual: 13,
    estado: 1,
    esperaPlataforma: 3,
    esperaVentanilla: 10,
    latOficina: -12.09476213184221,
    longOficina: -77.03749148208638,
  },
  {
    id: 8,
    nombre: "PETIT THOUARS",
    direccion: "AV. PETIT THOUARS N?? 2790 ESQ. JR. PERCY GIBSON",
    idEstado: 0,
    idProvincia: 0,
    idPais: 0,
    aforoTotal: 35,
    aforoActual: 4,
    estado: 1,
    esperaPlataforma: 0,
    esperaVentanilla: 4,
    latOficina: -12.090902735799261,
    longOficina: -77.0325035910043,
  },
  {
    id: 9,
    nombre: "AV. CENTRAL",
    direccion: "AV. BASADRE 133",
    idEstado: 0,
    idProvincia: 0,
    idPais: 0,
    aforoTotal: 30,
    aforoActual: 14,
    estado: 2,
    esperaPlataforma: 4,
    esperaVentanilla: 10,
    latOficina: -12.094875955343744,
    longOficina: -77.03747295554199,
  },
  {
    id: 10,
    nombre: "LOS ROBLES",
    direccion: "AV. DOS DE MAYO 1198",
    idEstado: 0,
    idProvincia: 0,
    idPais: 0,
    aforoTotal: 20,
    aforoActual: 8,
    estado: 0,
    esperaPlataforma: 2,
    esperaVentanilla: 6,
    latOficina: -12.091665165027399,
    longOficina: -77.0429241316625,
  },
  {
    id: 13,
    nombre: "CONQUISTADORES",
    direccion: "AV. CONQUISTADORES 1099",
    idEstado: 0,
    idProvincia: 0,
    idPais: 0,
    aforoTotal: 40,
    aforoActual: 31,
    estado: 0,
    esperaPlataforma: 11,
    esperaVentanilla: 20,
    latOficina: -12.10701123395324,
    longOficina: -77.0370306640618,
  },
];

function initMap() {
  consult();
  setInterval(() => {
    consult();
  }, 60000);
}
