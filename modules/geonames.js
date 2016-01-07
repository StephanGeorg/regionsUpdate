var request = require('request'),
    util = require('util');

module.exports = function(params){

  this.username = params.username  || null;
  this.endpoint = 'https://secure.geonames.net/';

  /*
   *  Parse result from geonames
   */
  this.parseResult = function(result,detailed,callback) {
    var res;
    if(result.totalResultsCount) {
      if(result.geonames.length > 1) {
        // to do: edit multiple
        console.log("Geonames: 🖖  Multiple results found!");
        res = result.geonames[0];
      } else {
        res = result.geonames[0];
      }
      if(res && !detailed) {
        return res;
      }
      if(detailed) {
        if(typeof callback === 'function') {
          this.get('get',{geonameId: res.geonameId},function(err_get,res_get){
            if(err_get){
              callback(err_get);
            }
            if(res_get) {
              var data = {
                geonames: {
                  id: res_get.geonameId,
                  bbox: res_get.bbox,
                  fcode: res_get.fcode,
                  country: res_get.countryCode,
                  continent: res_get.continentCode,
                }
              };
              if(res_get.timezone) {
                data.geonames.timezone = res_get.timezone;
              }
              if(res_get.wikipediaURL) {
                data.wiki = {
                  url: res_get.wikipediaURL
                };
              }
              callback(null,data);
            }
          });
          return;
        } else {
          throw('Geonames: Parser callback not specified!');
        }
      }
    }

    callback(true,null);
  };

  /**
  * Get JSON data from Geonames endpoints
  */
  this.get = function(type,params,callback) {

    if(typeof callback !== 'function') {
      throw('Callback must be a function');
    }
    var endpoint = this.endpoint + type + 'JSON',
        query = params || {};

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
