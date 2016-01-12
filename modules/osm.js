var request = require('request'),
    util = require('util'),
    _ = require('underscore'),
    turf = require('turf');

module.exports = function(params){

  params = params || {};
  this.username = params.username || null;
  this.endpoint = 'http://osm.nearest.place/';

  /*
   *  Parse result from geonames
   */
  this.parseResult = function(result,region) {

    if(result.length) {
      var polygons = {
        "type": "FeatureCollection",
        "features": []
      };

      //return result[0];
      _.each(result,function(res){
        polygons.features.push({
          "type": "Feature",
          "geometry": JSON.parse(res.way)
        });
      });

      return {
        id: region.id,
        admin_level: region.properties.admin_level,
        SRID: parseInt(region.properties.SRID),
        rpath: region.rpath.map(returnInt),
        center: turf.center(polygons).geometry,
        bbox: turf.bboxPolygon(turf.extent(polygons)).geometry,
        area: turf.area(polygons),
        timestamp: region.timestamp
      };
    }
    return false;
  };

  /**
   * Get JSON data from OSM server
   */
  this.get = function(type,params,callback) {

    if(typeof callback !== 'function') {
      throw('Callback must be a function');
    }
    var endpoint = this.endpoint + type,
        query = params || {};

    //query.username = this.username;

    request.get({url: endpoint, qs: query},function (error, response, body) {
      if(error){
        callback(error,null);
      }
      if(response && response.statusCode !== 200){
        throw('Invalid Status Code Returned:', response.statusCode);
      }
      if(body){
        callback(null,JSON.parse(body));
      }
    });
  };




};

function returnInt(element){
  return parseInt(element,10);
}
