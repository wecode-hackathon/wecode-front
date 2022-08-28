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

    textModal.innerHTML = locator.locations[locationIdx].title;

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
        scale: 13,
        fillColor: "#004481",
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
  fetch(
    "http://127.0.0.1:5001/api/admin/suscripcion/seguimiento/declaracionSaludInicio/1779",
    {
      method: "GET",
      headers: {
        "Content-type": "application/json; charset=UTF-8",
      },
    }
  )
    .then((response) => response.json())
    .then((responseData) => {
      console.log("llegó data");
      CONFIGURATION.locations = [
        {
          title: "BBVA San Isidro",
          address1: "Av. República de Panamá 3055",
          coords: { lat: -12.093568745989225, lng: -77.02118792209015 },
          aforo: "20 personas",
          // color: "#000000",
        },
        {
          title: "BBVA Las Begonias",
          address1: "C. Las Begonias 425 - 429",
          coords: { lat: -12.09257812276688, lng: -77.02414703558195 },
          aforo: "25 personas",
          // color: "#FF0000",
        },
      ];
      new LocatorPlus(CONFIGURATION);
    })
    .catch((error) => console.warn(error));
}

function initMap() {
  // consult();
  setInterval(() => {
    if (navigator.geolocation) {
      var success = function (position) {
        let latitud = position.coords.latitude,
          longitud = position.coords.longitude;
        // console.log(latitud);
        // console.log(longitud);
      };
      navigator.geolocation.getCurrentPosition(success, function (msg) {
        console.error(msg);
      });
    }
  }, 2000);

  CONFIGURATION.locations = [
    {
      title: "BBVA San Isidro",
      address1: "Av. República de Panamá 3055",
      coords: { lat: -12.093568745989225, lng: -77.02118792209015 },
      aforo: "20 personas",
      // color: "#000000",
    },
    {
      title: "BBVA Las Begonias",
      address1: "C. Las Begonias 425 - 429",
      coords: { lat: -12.09257812276688, lng: -77.02414703558195 },
      aforo: "25 personas",
      // color: "#FF0000",
    },
  ];

  new LocatorPlus(CONFIGURATION);

  // new LocatorPlus(CONFIGURATION);
}
