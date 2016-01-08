var request = require('request'),
    util = require('util'),
    turf = require('turf'),
    _ = require('underscore'),
    colors = require('colors');

module.exports = function(params){

  this.username = params.username  || null;
  this.endpoint = 'https://secure.geonames.net/';

  /*
   *  Parse result from geonames
   */
  this.parseResult = function(result,detailed,mode,callback) {

    if(detailed){
      this.parseResultDetailed(result,mode,function(error_parse,result_parse){
        if(error_parse) {
          callback(error_parse);
        }
        if(result_parse){
          callback(null,result_parse);
        }
      });
    }

  };

  /*
   *  Parse detailed result
   */
  this.parseResultDetailed = function(result,mode,callback) {

    var self = this;

    if(typeof callback === 'function') {
      this.get('get',{geonameId: result.geonameId},function(err_get,res_get){
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
              center: {
                type: "Point",
                coordinates: [
                  res_get.lng,
                  res_get.lat,
                ]
              },
              match: self.exactMatch(mode)
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

    callback(true,null);
  };

  /*
   *  Verify the search result
   */
  this.parseSearch = function(result,region,mode,callback){
    var res;
    if(result.totalResultsCount) {

      if(result.geonames.length > 1) {
        // to do: edit multiple
        console.log("Geonames: 🖖  Multiple results found!");
        res = result.geonames[0];
      } else {
        res = result.geonames[0];
      }

      // distance
      if(mode.notgeo) {
        res = this.getNearest(result,region);
        if(res) {
          console.log("Geonames: Found geonameID ".green + res.geonameId + " based on distance!".cyan);
        } else {
          console.log("Geonames: Not Found based on distance!".red);
        }
      }

      if(res) {
        return res;
      }
    }
    return;
  };

  this.checkNearest = function(min,region) {
    var p1 = {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": region.osm.bbox.coordinates[0][0]
      }
    };
    var p2 = {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": region.osm.bbox.coordinates[0][2]
      }
    };
    var distance = turf.distance(p1,p2);

    console.log("Geonames: check distances: " + min + " 10% of bbox: " + ((distance/2)+(distance*0.1)));

    if(min < ((distance/2)+(distance*0.1))) {
      return true;
    }
    return;
  };


  /*
   *
   */
  this.getNearest = function(result,region){
    var dists = [],
        reg = [];
    _.each(result.geonames,function(sr){
      var point1 = {
        "type": "Feature",
        "geometry": {
          "type": "Point",
          "coordinates": [parseFloat(sr.lng),parseFloat(sr.lat)]
        }
      };
      var point2 = {
        "type": "Feature",
        "geometry": region.osm.center
      };
      dists.push(turf.distance(point1,point2));
      reg.push(sr);
    });
    var minimum = Array.min(dists);
    var index = dists.indexOf(minimum);

    if(this.checkNearest(minimum,region)) {
      return reg[index];
    }
    return;
  };

  this.exactMatch = function(mode){
    var result = {};

    if(mode.fuzzy) {
      result.fuzzy = 1;
    }
    if(mode.notgeo) {
      result.notgeo = 1;
    }

    return result;

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

Array.min = function( array ){
    return Math.min.apply( Math, array );
};
