var request = require('request'),
    util = require('util');

module.exports = function(params){

  params = params || {};
  this.username = params.username || null;
  this.endpoint = 'http://osm.nearest.place/';

  /*
   *  Parse result from geonames
   */
  this.parseResult = function(result) {
    if(result.length) {
      if(result.length > 1) {
        return result[0];
      } else {
        return result[0];
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

    console.log(endpoint);
    console.log(query);

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
