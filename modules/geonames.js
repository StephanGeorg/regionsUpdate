var request = require('request'),
    util = require('util');

module.exports = function(params){

  this.username = params.username  || null;
  this.endpoint = 'https://secure.geonames.net/';

  /*
   *  Parse result from geonames
   */
  this.parse = function() {

  };

  /**
  * Get JSON data from Geonames endpoints
  */
  this.get = function(type,params,callback) {

    if(typeof callback !== 'function') {
      throw('Callback must be a function');
    }
    var endpoint = this.endpoint + '/' + type + 'JSON',
        query = params || {};

    //console.log("############## GEONAMES" ,query);

    query.username = this.username;
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
