var request = require('request'),
    util = require('util'),
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
      if(result.length > 1) {
        return result[0];
      } else {

        var area = {
          "type": "Feature",
          "geometry": JSON.parse(result[0].way)
        };

        return {
          id: region.id,
          admin_level: region.properties.admin_level,
          SRID: parseInt(region.properties.SRID),
          rpath: region.rpath.map(returnInt),
          center: JSON.parse(result[0].center),
          bbox: JSON.parse(result[0].bbox),
          area: turf.area(area),
          timestamp: region.timestamp
        };
      }
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
