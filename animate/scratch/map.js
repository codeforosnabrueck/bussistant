const mapbox_token = "pk.eyJ1IjoidGlub20iLCJhIjoiY2ppa2dzOXd2MHhjNDN2b3dkeXlhMzQ3NyJ9.-GK7-nWyeh988RBOhjUwtQ";
const mymap = L.map('mapid').setView([51.961436, 7.626816], 13);
L.MakiMarkers.accessToken = mapbox_token;

const lastSeen = {};

const markers = {};


L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox.streets',
    accessToken: mapbox_token
}).addTo(mymap);
const fahrtGroup = L.layerGroup();
fahrtGroup.addTo(mymap);
var message = document.getElementById("message");
const exampleSocket = new WebSocket("wss://swms-conterra.fmecloud.com/websocket");
const praeambel = function () {
    exampleSocket.onopen = function (event) {
        console.log("WebSocket is open now.");
        vcount.textContent = "Websocket successfully connected.";
        exampleSocket.send('{ "ws_op":"open","ws_stream_ids":["swmslive"]}');
    }
};

// fetch("https://swms-conterra.fmecloud.com/fmedatastreaming/IVU/service.fmw/fahrten/-12860043")
//     .then(response => response.json())
//     .then(response => {
//         // const animatedMarker = L.animatedMarker(response.geometry.coordinates);
//         let coords = [];
//         for (let coord of response.geometry.coordinates){
//             coords.push([coord[1], coord[0]])
//         }
//         const line = L.polyline(coords);
//         const animatedMarker = L.animatedMarker(line.getLatLngs());
//         mymap.addLayer(animatedMarker);

//         currentLine = L.geoJSON(response, {style:{color:"#ff1213"}});
//         currentLine.addTo(fahrtGroup);

//         // for (let coord of response.geometry.coordinates){
//         //     let marker = L.marker([coord[1], coord[0]]);

//         //     marker.addTo(mymap);
//         // }
//     })

exampleSocket.onmessage = function (event) {
    message.textContent = event.data;
    let vehicles = JSON.parse(event.data);
    vehicles = vehicles.features.filter(vehicle => vehicle.properties.LinienID === '6') 
    for (let vehicle of vehicles) {
        if (vehicle.properties.operation === "UPDATE") {
            if (vehicle.properties.FahrtBezeichner in markers) {
                markers[vehicle.properties.FahrtBezeichner].setLatLng([vehicle.geometry.coordinates[1], vehicle.geometry.coordinates[0]]);
                markers[vehicle.properties.FahrtBezeichner].update();
            } else {
                let label = vehicle.properties.LinienText;
                if (label.startsWith("R") || label.startsWith("E") || label.startsWith("N")) {
                    label = label.substr(1);
                }
                let marker = L.marker([vehicle.geometry.coordinates[1], 
                                        vehicle.geometry.coordinates[0]]);
                // marker.bindTooltip(vehicle.properties.LinienText).openTooltip();
                marker.title = "Linie " + vehicle.properties.LinienText;
                marker.fahrtbezeichner = vehicle.properties.FahrtBezeichner;
                let popUpText = "";
                try {
                    popUpText = JSON.stringify(vehicle, null, 2);
                }
                catch (err) {
                    console.log(err)
                }
                marker.bindPopup(popUpText).openPopup();
                marker.on('popupopen', function(event) {
                    var marker = event.target;
                    fahrtGroup.clearLayers();
                    httpGetAsync("https://swms-conterra.fmecloud.com/fmedatastreaming/IVU/service.fmw/fahrten/"+marker.fahrtbezeichner, addLine);
                    httpGetAsync("https://swms-conterra.fmecloud.com/fmedatastreaming/IVU/service.fmw/fahrten/"+marker.fahrtbezeichner+"/stops", addStops);
                });
                fetch("https://swms-conterra.fmecloud.com/fmedatastreaming/IVU/service.fmw/fahrten/"+marker.fahrtbezeichner+"/stops")
                .then(response => response.json())
                .then(response => response.stops.filter(stop => stop.properties.halteid === vehicle.properties.AktHst))
                .then(stop => {
                    stop = stop[0]
                    console.log('stop', stop)
                    console.log('ab', new Date(stop.properties.abfahrtprognose))
                    // stop.abfahrtprognose = '2018-10-05T15:09:25+00:00'
                    // stop.abfahrt = '2018-10-05T15:07:25+00:00'
                    const delay = new Date(stop.properties.abfahrtprognose) - new Date(stop.properties.abfahrt)
                    console.log('delay', delay)
                    let delayInMinutes;
                    if (isNaN(delay)){
                        delayInMinutes = 'unknown'
                    } else {
                        delayInMinutes = new Date(delay).getMinutes()
                    }
                    return delayInMinutes
                })
                .then(delayInMinutes => {
                    marker.bindTooltip(`${delayInMinutes} minutes delay`).openTooltip()
                    const icon = L.MakiMarkers.icon({icon: label, 
                                                     color: delayToColor(delayInMinutes), 
                                                     size: "m"});
                    marker.setIcon(icon)
                    marker.addTo(mymap);
                    markers[vehicle.properties.FahrtBezeichner] = marker;

                })
            }

 

        } else {
            if (vehicle.properties.FahrtBezeichner in markers) {
                mymap.removeLayer(markers[vehicle.properties.FahrtBezeichner]);
                delete(markers[vehicle.properties.FahrtBezeichner]);
            }
        }

    }
    vcount.textContent = "Currently live: " + Object.keys(markers).length + " Vehicles"
};
//-12847047
function httpGetAsync(theUrl, callback)
{
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
            callback(xmlHttp.responseText);
    };
    xmlHttp.open("GET", theUrl, true); // true for asynchronous
    xmlHttp.send(null);
};

function addLine(event) {
    currentLine = L.geoJSON(JSON.parse(event),{style:{color:"#ff1213"}});
    currentLine.addTo(fahrtGroup);
};

const delayToColor = delayInMinutes => {
    return delayInMinutes > 10   ? '#800026' :
           delayInMinutes > 5    ? '#BD0026' :
           delayInMinutes >= 2   ? '#FD8D3C' :
           delayInMinutes === 1  ? '#FEB24C' :
           delayInMinutes === 0  ? '#008000' :
                                   '#a6a6a6';
}

function addStops(event) {
    response = JSON.parse(event);
    for (var key in response.stops) {
        stop = response.stops[key];
        var icon = L.MakiMarkers.icon({icon: "bus", color: "#13f243", size: "s"});
        var marker = {
            pointToLayer: function (feature, latlng) {
                return L.marker(latlng, {icon: icon,title : response.stops[key].properties.haltestelle}).bindPopup(JSON.stringify(response.stops[key].properties, null, 2)).openPopup();
            }
        };
        var cstop = L.geoJSON(stop, marker);
        cstop.addTo(fahrtGroup);
    }
};

praeambel();