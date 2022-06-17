var LETTERAEMME = LETTERAEMME || {};
LETTERAEMME.modules = LETTERAEMME.modules || {};
LETTERAEMME.context = LETTERAEMME.context || {
  lang: "it",
  map: {
    current: undefined,  
    currentMarker: undefined,  
    center: [38.19941, 15.55602],
    initialZoom: 12,
    minZoom: 11,
    maxZoom: 19,
    layers: {},
    layersGroups: {},
    tileLayers: {},
    markers: []
  },
  urls: {
    dizionario_sindaci: "data/dizionario_sindaci.json",
    sezioni: "data/sezioni.geojson",
    sindaci: "data/sindaci.json",
    votanti: "data/votanti.json",
    bianche_nulli_contestazioni: "data/bianche_nulli_contestazioni.json",
    current: {}
  },
 db: {}
};

 LETTERAEMME.templates = LETTERAEMME.templates || {
    peityMarker: (values) =>
      `<div id="marker-${values.id}" data-sezione="${values.id}" title="${values.nome}">
        <span class="chart ${values.class}" data-fills="${values.fills}" data-size="${values.size}">${values.serie}</span>
      </div>`,
    bgMarker: (values) =>
      `<div id="marker-${values.id}" class="chart ${values.class}" data-sezione="${values.id}" style="${values.style}"  title="${values.nome}">
      ${values.content ? values.content : ""}
      </div>`,
    popupSindaco: (values) =>
        `<div id="popup-${values.id}" class="popup ${values.class}" data-sezione="${values.id}">
            <h1>${values.sezione.nome}</h1>
            <h2>Nr. Sezione: <b>${values.sezione.sezioni.join(", ")}</b></h2>
            <h2>Elettori / Votanti: <b>${values.sezione.totali.elettori}</b> / <b>${values.sezione.totali.votanti}</b> (<i>${(values.sezione.totali.elettori>0 && values.sezione.totali.votanti>0)  ? parseFloat(((values.sezione.totali.votanti/values.sezione.totali.elettori)*100).toFixed(2)) : 0}%</i>)</h2>
            <h2>Voti validi: <b>${values.sezione.totali.voti_sindaco}</b> (<i>${(values.sezione.totali.votanti>0 && values.sezione.totali.voti_sindaco>0)  ? parseFloat(((values.sezione.totali.voti_sindaco/values.sezione.totali.votanti)*100).toFixed(2)) : 0}%</i>)</h2>
            <h2>Bianche / Nulli / Contestate: <b>${values.sezione.totali.bianche}</b> / <b>${values.sezione.totali.nulli}</b> / <b>${values.sezione.totali.contestazioni}</b> (<i>${((parseInt(values.sezione.totali.bianche,10)+parseInt(values.sezione.totali.nulli,10)+parseInt(values.sezione.totali.contestazioni,10))>0 && values.sezione.totali.votanti >0)  ? parseFloat((((parseInt(values.sezione.totali.bianche)+parseInt(values.sezione.totali.nulli)+parseInt(values.sezione.totali.contestazioni))/values.sezione.totali.votanti)*100).toFixed(2)) : 0}%</i>)</h2>            
            <ul>${values.sezione.sindaciSorted.map((sindaco)=>{
              return `<li style="--dot-color:${sindaco.colore};">${sindaco.nome}: <b>${sindaco.voti}</b> (<i>${sindaco.perc}%</i>)</li>`
            }).join("")}</ul>
        </div>`      
 };

 LETTERAEMME.modules.main = (function (ns) {

  /*******************************************************************************/

   const setup = async function setup() {
    setMap();

    await loadData().then(() => {
        renderData();  
        setNavigator();
        showAllMarkers();
        });        
    };

  /*******************************************************************************/

  const setNavigator = function setNavigator() {
    const wrapper = document.querySelector("#mapWrapper"),
      navigator = wrapper.querySelector("#mapNavigator"),
      toggleButton = navigator.querySelector(".btnToggler"),
      txtSearchSezioni =  navigator.querySelector("[list=lstSezioni]"),
      lstSezioni =  navigator.querySelector("#lstSezioni");

    toggleButton.addEventListener("click", (event) => {
      toggleSidebar(navigator.getAttribute("aria-expanded") == "false");
    });

    for (let idSezione in ns.context.db) {
      const sezione =  ns.context.db[idSezione];
      let opt = document.createElement("option");

        opt.dataset.id=idSezione;
        opt.value=sezione.nome;

      lstSezioni.append(opt);
    }    

    delegate(navigator, "change", "[type='radio']", function (evt) {
      renderData();
    });


    txtSearchSezioni.addEventListener("input" , function (evt) { 
      let optionFound = false;

      for (var j = 0; j < lstSezioni.options.length; j++) {
        let opt = lstSezioni.options[j];

        if (txtSearchSezioni.value.toUpperCase().trim() == opt.value.toUpperCase().trim()) {
            optionFound = true;
            txtSearchSezioni.value= "";
            const marker = selectMarker(opt.dataset.id);

            if (marker) {
              ns.context.map.current.flyTo(marker.getLatLng(), 18);
              marker.openPopup();
            }
            break;
        }
      }

    });


  };    

  /*******************************************************************************/

  const toggleSidebar = function toggleSidebar(open) {
    const state = open ? true : false,
      wrapper = document.querySelector("#mapWrapper"),
      navigator = wrapper.querySelector("#mapNavigator"),
      btnToggler = navigator.querySelector(".btnToggler");

    wrapper.classList.toggle("navigatorOpen", state);

    navigator.setAttribute("aria-expanded", state);

    const labelToggler = state ? "Chiudi navigazione" : "Apri navigazione";
    btnToggler.setAttribute("title", labelToggler);
    btnToggler.setAttribute("aria-label", labelToggler);
  };    

  /*******************************************************************************/

  const setMap = function setMap() {
    setTileLayerGroups();

    ns.context.map.current = L.map("mapContainer", {
      zoomControl: false,
      attributionControl: false,
    })
      .setView(ns.context.map.center, ns.context.map.initialZoom)
      .addLayer(ns.context.map.layersGroups.mapGraph);
      
    document.querySelector("#mapWrapper").dataset.zoom =  ns.context.map.initialZoom;

    setMapControls();

    const resizeObserver = new ResizeObserver((entries) => {
        ns.context.map.current.invalidateSize();
        if (ns.context.map.currentMarker)
          ns.context.map.current.panTo(ns.context.map.currentMarker.getLatLng());
      });
  
      resizeObserver.observe(document.querySelector("#mapContainer"));
  
   }

  /*******************************************************************************/

  const setTileLayerGroups = function setTileLayerGroups() {
    setTiles({
        name: "OpenStreetMap_HOT",
        url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">Humanitarian OpenStreetMap Team</a> hosted by <a href="https://openstreetmap.fr/" target="_blank">OpenStreetMap France</a>',
        maxZoom: ns.context.map.maxZoom,
        minZoom: ns.context.map.minZoom,
      });

      setTiles({
        name: "CartoDB_Positron",
        url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
        minZoom: ns.context.map.minZoom,
      })
     /* setTiles({
        name: "Stamen_TonerLite",
        url: "https://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}{r}.{ext}",
        attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: 'abcd',
        ext: 'png',        
        maxZoom: ns.context.map.maxZoom,
        minZoom: ns.context.map.minZoom,
      });*/

      ns.context.map.layersGroups.mapGraph = L.layerGroup([
        ns.context.map.tileLayers.OpenStreetMap_HOT,
      ]);
      ns.context.map.layersGroups.mapHighContrast = L.layerGroup([
        ns.context.map.tileLayers.CartoDB_Positron,
      ]);      
      /*ns.context.map.layersGroups.mapHighContrast = L.layerGroup([
        ns.context.map.tileLayers.Stamen_TonerLite,
      ]);*/
    }

    /*******************************************************************************/

    const setTiles = function setTiles(options) {

        const layer = L.tileLayer(options.url, {
            attribution: options.attribution,
            subdomains: options.subdomains || "abc",
            maxZoom: options.maxZoom,
            minZoom: options.minZoom,
            ext: options.ext || "png",
            useCache: true,
            crossOrigin: true,
        })
        /*.on("loading", function (event) {
        toggleLoading(true);
        })
        .on("load", function (event) {
        toggleLoading(false);
        })*/;

    ns.context.map.tileLayers[options.name] = layer;

    return layer;
    };


  /*******************************************************************************/

    const toggleLoading = function toggleLoading(state) {
        document.querySelector("#mapWrapper").classList.toggle("loading",state);
      };

  /*******************************************************************************/

  const setMapControls = function setMapControls() {
    setMapZoomControls();
    setMapLayersControls();

    L.control
      .attribution({
        position: "bottomleft",
      })
      .addTo(ns.context.map.current);
  };      

  /*******************************************************************************/

  const setMapZoomControls = function setMapZoomControls() {
    L.Control.zoomBar = L.Control.extend({
      options: {
        position: "topleft",
        zoomInTitle: "Zoom in",
        zoomOutTitle: "Zoom out",
        zoomHomeTitle: "Reset",
      },

      onAdd: function (map) {
        var controlName = "ctl-zoom",
          container = L.DomUtil.create("div", controlName + " leaflet-bar"),
          options = this.options;

        this._zoomInButton = this._createButton(
          "",
          options.zoomInTitle,
          controlName + "-in",
          container,
          this._zoomIn
        );
        this._zoomOutButton = this._createButton(
          "",
          options.zoomOutTitle,
          controlName + "-out",
          container,
          this._zoomOut
        );
        this._zoomHomeButton = this._createButton(
          "",
          options.zoomHomeTitle,
          controlName + "-home",
          container,
          this._zoomHome
        );

        this._updateDisabled();
        map.on("zoomend zoomlevelschange moveend", this._updateDisabled, this);
        map.on("zoomstart zoomend", ()=> { document.querySelector("#mapWrapper").dataset.zoom=this._map._zoom }, this);

        return container;
      },

      onRemove: function (map) {
        map.off("zoomend zoomlevelschange", this._updateDisabled, this);
      },

      _zoomIn: function (e) {
        this._map.zoomIn(e.shiftKey ? 3 : 1);
      },

      _zoomOut: function (e) {
        this._map.zoomOut(e.shiftKey ? 3 : 1);
      },

      _zoomHome: function (e) {
        showAllMarkers();
      },
      _createButton: function (html, title, className, container, fn) {
        var link = L.DomUtil.create("a", className, container);
        link.innerHTML = html;
        link.href = "#";
        link.title = title;
        link.setAttribute("tabindex", 0);
        link.setAttribute("aria-label", title);
        link.setAttribute("role", "button");

        L.DomEvent.on(link, "mousedown dblclick", L.DomEvent.stopPropagation)
          .on(link, "click", L.DomEvent.stop)
          .on(link, "click", fn, this)
          .on(link, "click", this._refocusOnMap, this);

        return link;
      },

      _updateDisabled: function () {
        var map = this._map,
          className = "leaflet-disabled";

        L.DomUtil.removeClass(this._zoomInButton, className);
        L.DomUtil.removeClass(this._zoomOutButton, className);

        if (map._zoom === map.getMinZoom()) {
          L.DomUtil.addClass(this._zoomOutButton, className);
          this._zoomOutButton.setAttribute("aria-disabled", true);
          this._zoomInButton.setAttribute("aria-disabled", false);
        } else if (map._zoom === map.getMaxZoom()) {
          L.DomUtil.addClass(this._zoomInButton, className);
          this._zoomInButton.setAttribute("aria-disabled", true);
          this._zoomOutButton.setAttribute("aria-disabled", false);
        } else {
          this._zoomInButton.setAttribute("aria-disabled", false);
          this._zoomOutButton.setAttribute("aria-disabled", false);
        }
      },
    });

    const zoomBar = new L.Control.zoomBar();
    zoomBar.addTo(ns.context.map.current);
  };  

  /*******************************************************************************/

  const setMapLayersControls = function setMapLayersControls() {
    L.Control.layerBar = L.Control.extend({
      options: {
        position: "topleft",
        titles: {
          mapGraph: "Geografica",
          //mapPhoto: "Fotografica",
          mapHighContrast: "Alto contrasto",
        },
        labels: {
          mapGraph: "Visualizza mappa Geografica",
          //mapPhoto: "Visualizza mappa Fotografica",
          mapHighContrast: "Visualizza mappa  ad Alto contrasto",
        },
      },
      onAdd: function (map) {
        let controlName = "ctl-layers",
          container = L.DomUtil.create("div", controlName + " leaflet-bar"),
          options = this.options,
          that = this;

        this._mapLayerButtons = {};

        Object.keys(ns.context.map.layersGroups).forEach(function (name) {
          that._mapLayerButtons[name] = that._createButton(
            "",
            options.titles[name],
            options.labels[name],
            controlName + "-" + name,
            name,
            container,
            that._switchLayerGroup
          );
        });

        L.DomUtil.addClass(this._mapLayerButtons.mapGraph, "leaflet-disabled");
        this._mapLayerButtons.mapGraph.setAttribute("aria-pressed", true);
        return container;
      },
      _switchLayerGroup: function (evt) {
        let btn = evt.currentTarget,
          action = btn.dataset.action,
          that = this;

        Object.keys(ns.context.map.layersGroups).forEach(function (name) {
          L.DomUtil.removeClass(
            that._mapLayerButtons[name],
            "leaflet-disabled"
          );
          that._mapLayerButtons[name].setAttribute("aria-pressed", false);

          if (
            ns.context.map.current.hasLayer(ns.context.map.layersGroups[name])
          )
            ns.context.map.current.removeLayer(
              ns.context.map.layersGroups[name]
            );
        });

        L.DomUtil.addClass(this._mapLayerButtons[action], "leaflet-disabled");
        that._mapLayerButtons[action].setAttribute("aria-pressed", true);
        ns.context.map.current.addLayer(ns.context.map.layersGroups[action]);
      },
      _createButton: function (
        html,
        title,
        label,
        className,
        action,
        container,
        fn
      ) {
        var link = L.DomUtil.create("a", className, container);
        link.dataset.action = action;
        link.innerHTML = html;
        link.href = "#";
        link.title = title;
        link.setAttribute("tabindex", 0);
        link.setAttribute("aria-label", label);
        link.setAttribute("aria-pressed", false);
        link.setAttribute("role", "button");

        L.DomEvent.on(link, "mousedown dblclick", L.DomEvent.stopPropagation)
          .on(link, "click", L.DomEvent.stop)
          .on(link, "click", fn, this);

        return link;
      },
    });

    const layersBar = new L.Control.layerBar();
    layersBar.addTo(ns.context.map.current);
  };

  /*******************************************************************************/


  const loadData = async function loadData() {
    return new Promise((resolve, reject) => {

        toggleLoading(true);  

          Promise.all([
            fetch(ns.context.urls.sezioni).then((res) => res.json()),
            fetch(ns.context.urls.sindaci).then((res) => res.json()),
            fetch(ns.context.urls.dizionario_sindaci).then((res) => res.json()),        
            fetch(ns.context.urls.votanti).then((res) => res.json()),
            fetch(ns.context.urls.bianche_nulli_contestazioni).then((res) => res.json())                        
          ]).then((data)=>{
            const dataPacket = {
              sezioni : data[0],
              sindaci : data[1],
              dizionario_sindaci : data[2],
              votanti : data[3],
              bianche_nulli_contestazioni : data[4],
            }
  
            const worker_db = new Worker("scripts/createDB.worker.js");
  
            worker_db.onmessage = (msg) => {
              if (msg.data.result)  {
                ns.context.db = msg.data.db;
                toggleLoading(false);  
                resolve();
              }else  {
                alert("Si è verificato un errore durante l'elaborazione dei dati") ;
                toggleLoading(false);  
                reject();
              }
            }          
  
            worker_db.postMessage(dataPacket);

          }).catch ((err)=>{
            alert("Si è verificato un errore durante il recupero dei dati") ;
            toggleLoading(false);    
            console.error(err);
            reject();
        })

      });
  };  

    
    
  /*******************************************************************************/

  const renderData = function renderData() {
    
    toggleLoading(true);  

    const navigator = document.querySelector("#mapNavigator"),
          mapContainer = document.querySelector("#mapContainer"),
          settings =  getSettings();

          if (ns.context.map.layers.sezioni) resetMap();
          
          ns.context.map.layers.sezioni = new L.layerGroup();

          Object.keys(ns.context.db).forEach((sezione) => {
            marker = renderMarker(sezione,ns.context.db[sezione],settings);
            ns.context.map.markers.push(marker);
            marker.addTo(ns.context.map.layers.sezioni);
          });          

          ns.context.map.layers.sezioni.addTo(ns.context.map.current);

          if (["bar","pie","donut"].includes(settings.grafico)) {
            mapContainer.querySelectorAll(".peityMarker .chart").forEach((el)=>{
              peity(el,settings.grafico,{"fill" : el.dataset.fills.split(","), "height": el.dataset.size, "width": el.dataset.size });
              el.classList.add("rendered");
            });
          }          

    const markersGroup = new L.featureGroup(ns.context.map.markers);

    //ns.context.map.current.setMaxBounds(ns.context.map.current.getBounds());
    ns.context.map.current.setMaxBounds(
      L.latLngBounds(
        markersGroup.getBounds().getSouthWest(),
        markersGroup.getBounds().getNorthEast()
      ).pad(1)
    );

    toggleLoading(false);  

  };

  /*******************************************************************************/

  const getSettings = function getSettings() {
    const
    navigator = document.querySelector("#mapNavigator"),
    //dati = navigator.querySelector("[name='dati']:checked").value,
    dati = "sindaci",
    grafico = navigator.querySelector("[name='grafico']:checked").value;

    return {
      dati: dati,
      grafico: grafico
    }
  };

  /*******************************************************************************/
  const renderMarker = function renderMarker(id, sezione, settings ) {

    const  latlng = new L.latLng(sezione.latlng[1],sezione.latlng[0]);

    let html, className, size = renderSize(sezione,settings);

    if (["bar","pie","donut"].includes(settings.grafico)) {
      const values = {
        id:id,
        nome:escapeHtml(sezione.nome),
        class: settings.grafico,
        serie : renderSerie(sezione,settings),
        fills: renderFills(sezione,settings),
        size: size
      };
      className = "peityMarker",

      html = ns.templates.peityMarker(values);      
    } else  {
      const values = {
        id:id,
        nome:escapeHtml(sezione.nome),
        class: settings.grafico,
        style: renderStyle(sezione,settings),
        content: renderContent(sezione,settings),
        size: size
      };
      className = "bgMarker",

      html = ns.templates.bgMarker(values);      
    }   
    
    const  markerIcon = L.divIcon({
      iconSize: [size, size],
      shadowSize: [0, 0],
      iconAnchor: [size/2, size],
      popupAnchor: [0, -(size+5)],
      tabIndex: -1,
      className: className,
      html: html,
    }),
    marker = L.marker(latlng, {
      icon: markerIcon,
      externalID: "marker_" + id,
    });


    marker.bindPopup(renderPopup(id, sezione, settings ), {
      closeOnClick: true,
      autoClose: true,
      closeButton: false,
    });

  return marker;

  };

  /*******************************************************************************/
  const renderPopup = function renderPopup(id, sezione, settings ) {
    let tmpl, popupValues;  
    if (settings.dati=="sindaci") {
       popupValues = {
        id:id,
        class: settings.grafico,
        sezione: sezione
      }
      tmpl = ns.templates.popupSindaco
    }

    return tmpl(popupValues);
  };

    /*******************************************************************************/

    const selectMarker = function selectMarker(id) {

      return ns.context.map.markers.find((marker)=>{
          return (marker.options.externalID=="marker_" + id);
      });

    };

  /*******************************************************************************/

  const renderSize = function renderSize(data, settings) {  
    let total = 0;

    if (settings.dati=="sindaci") {
      total =  data.totali.voti_sindaco;
    }

    const minSize = 24, maxSize = 128

    let size = minSize, totalCeil = 200;

    while (total>totalCeil && size<=maxSize) {
      totalCeil+=200;
      size+=2;
    }
    
    return size;
  };  

  /*******************************************************************************/

  const renderFills = function renderFills(data, settings) {  
    if (settings.dati=="sindaci") {
       return data.sindaciSorted.map((o)=>{return o.colore}).join(",");
    }
  };  

  /*******************************************************************************/

  const renderSerie = function renderSerie(data, settings) {  
    if (settings.dati=="sindaci") {
       return data.sindaciSorted.map((o)=>{return o.voti}).join(",");
    }
  };  

  /*******************************************************************************/

  const renderContent = function renderContent(data, settings) {  
    let content = "";

    if (settings.grafico=="radial") {
      if (settings.dati=="sindaci") {
          const maxPerc = data.sindaciSorted[0].perc;
                
          if (maxPerc==0)
            content=`<div class="circle" style="background-color:#777;width:100%;height:100%;"></div>`;
          else
          data.sindaciSorted.forEach((sindaco)=>{
            const sizePerc = (100*sindaco.perc)/maxPerc;
            content+=`<div class="circle" style="background-color:${sindaco.colore};width:${sizePerc}%;height:${sizePerc}%;"></div>`;
          });
      };  
    };  
    return content;
  };  

  /*******************************************************************************/

  const renderStyle = function renderStyle(data, settings) {  
    let style = "";

    if (settings.grafico=="blend") {  
      style = "background-color: ";

      if (settings.dati=="sindaci") {
          let colors = [], weights = [], i=1,
              sindaco1 = data.sindaciSorted[0],
              sindaco2 = data.sindaciSorted[1],
              sindaco1perc = Math.ceil(sindaco1.perc),
              sindaco2perc = Math.ceil(sindaco2.perc);
          
              if (sindaco1perc==0)
                style += "#777";
              else if (sindaco1perc>(sindaco2perc+20))
                style += sindaco1.colore
              else {
                colors.push(sindaco1.colore);
                colors.push(sindaco2.colore);

                if (sindaco1.id!=4 && sindaco1perc>(sindaco2perc+1)) {//evidenziamo che si tratta di uno di quei (rari) casi in cui non ha prevalso Basile*/
                  weights.push(1);
                  weights.push(0.1);
                } else { 
                  weights.push(1);
                  weights.push(0.5);
               }

                style += chroma.average(colors, 'lrgb', weights);
              }  

          /*
          data.sindaciSorted.forEach((sindaco)=>{
              colors.push(sindaco.colore);
              weights.push(Math.ceil(sindaco.perc)/10);
          });
          style += chroma.average(colors, 'lrgb', weights) ;*/
      }
      style+= ";"
    } 
    
    return style;

  };  

    
  /*******************************************************************************/


  const showAllMarkers = function showAllMarkers() {
    const markersGroup = new L.featureGroup(ns.context.map.markers);

    ns.context.map.current.fitBounds(markersGroup.getBounds().pad(0));
  };

    
  /*******************************************************************************/

  const resetMap = function resetMap() {
    closeAllPopups();

    ns.context.map.current.removeLayer(
      ns.context.map.layers.sezioni
    );
    ns.context.map.markers = [];
    ns.context.map.currentMarker = undefined;

  };

  /*******************************************************************************/

  const closeAllPopups = function closeAllPopups() {
      ns.context.map.markers.forEach((marker) => {
        marker.closePopup();
      });
  };


  /*******************************************************************************/

    const delegate = function delegate(
        selector,
        eventType,
        childrenSelector,
        eventHandler,
        options
      ) {
        let element;
    
        if (!selector) element = document.querySelector("body");
        else if (typeof selector === "string" || selector instanceof String)
          element = document.querySelector(selector);
        else element = selector;
    
        let evts = eventType.split(",");
    
        for (var i = 0, l = evts.length; i < l; i++) {
          element.addEventListener(
            evts[i],
            function (eventOnElement) {
              if (eventOnElement.target.matches(childrenSelector)) {
                eventHandler(eventOnElement);
              }
            },
            options ? options : evts[i] == "scroll"
          );
        }
      };

  /*******************************************************************************/

  const escapeHtml = function escapeHtml(html) {
    let text = document.createTextNode(html);
    let p = document.createElement("p");
    p.appendChild(text);
    return p.innerHTML.replace(/"/g, "&quot;");
  };


  /*******************************************************************************/

  setup();

})(LETTERAEMME);
