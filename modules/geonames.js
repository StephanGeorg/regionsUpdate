var request = require('request'),
    http = require('http'),
    https = require('https'),
    Agent = require('agentkeepalive'),
    util = require('util'),
    turf = require('turf'),
    _ = require('underscore'),
    querystring = require('querystring'),
    urlencode = require('urlencode'),
    colors = require('colors');

module.exports = function(params){

  this.username = params.username  || null;
  this.url = 'https://secure.geonames.net';

  this.levels = [[],[],['PCLI','PCLD','PCLS','PCLF','PCL'],[],['ADM1','ADM2','ADMD','ADM1H'],[],['ADM2','ADM3','ADMD'],[],['ADM3','ADM4','ADM2'],[],[]];


  /*
   *
   */
  this.getAdminLevel = function(region,levels){
    var lev = this.levels[region.properties.admin_level];
    return lev.concat(levels);
  };

  /*
   *  Parse result from geonames
   */
  this.parseResult = function(result,detailed,run,region,callback) {

    if(detailed){
      this.parseResultDetailed(result,run,region,function(error_parse,result_parse){
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
  this.parseResultDetailed = function(result,run,region,callback) {

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
              match: self.exactMatch(run)
            },
            wiki: self.getWiki(res_get,region),
            names: self.orderName(res_get,region,run.country)
          };
          if(res_get.timezone) {
            data.geonames.timezone = res_get.timezone;
          }
          /*if(res_get.wikipediaURL) {
            data.wiki = {
              url: res_get.wikipediaURL
            };
          }*/
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
    var results =[],
        res,
        levels = region.levels;

    if(result.totalResultsCount) {

      //console.log(results);
      res = this.getNearest(result.geonames,region);

      // search for specific fcode
      _.each(levels,function(level){
        _.each(res,function(geoname){
          if(level === geoname.fcode) {
            results.push(geoname);
          }
        });
      });

      // no results with specific fcode found!
      if(!results.length) {
        return;
      }

      if(results.length > 1) {
        console.log("Geonames: 🖖  Multiple results found!");
      }

      return results[0];

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

    //console.log("Geonames: check distances: " + min + " 50% of bbox: " + ((distance/2)+(distance*0.5)));

    if(min < ((distance/2)+(distance*0.5))) {
      return true;
    }
    return;
  };


  /*
   *
   */
  this.getNearest = function(result,region){
    var dists = [],
        reg = [],
        self = this;
    _.each(result,function(sr){
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
      var distance = turf.distance(point1,point2);
      if(self.checkNearest(distance,region)){
        sr.distance = distance;
        reg.push(sr);
      }
    });

    reg = _.sortBy(reg, function(o) {
      return o.distance;
    });

    return reg;
  };

  this.exactMatch = function(mode){
    var result = {};

    if(mode.fuzzy) {
      result.fuzzy = 1;
    }

    return result;

  };


  /*
   *
   */
  this.orderName = function(result, region, country){

    region.country = country || {};

    var name = {},
        altsGeonames = result.alternateNames,
        altsOsm = region.properties.tags,
        alts = [],
        official = [];

    if(altsGeonames.length) {
      _.each(altsGeonames,function(name){
        if(name.lang && (name.lang.length === 2 || name.lang.length === 3)) {
          if(!_.findWhere(alts,{lang: name.lang,name: name.name})) {
            alts.push({
              lang: name.lang,
              name: name.name
            });
          }
        }
      });
    }

    var scans = ['name:','long_name:','official_name:'];

    _.each(scans,function(scan,scan_key){
      _.each(altsOsm,function(name, key){
        if(key.indexOf(scan) === 0) {
          var lang = key.replace(scan,'');
          if(!_.findWhere(alts,{lang: lang,name: name})){
            if(scan_key === 0) {
              if(lang !== 'prefix') {
                alts.push({lang: lang, name: name});
              }
            }
          } else {
            // remove long names
            if(scan_key === 1 || scan_key === 2) {
              alts = _.without(alts, _.findWhere(alts, {lang: lang, name: name}));
              official.push({lang: lang, name: name});
            }
          }
        }
      });
    });

    alts = _.sortBy(alts, function(o) {
      return o.lang;
    });

    return {
      localnames: this.getLocalNames(result,region,alts),
      i18n: alts,
      official: official
    };

  };

  this.getLocalNames = function(result,region,alts){

    var langs;

    if(region.properties.admin_level === 2) {
      langs = region.geodata.languages;
    } else {
      langs = region.country.geodata.languages;
    }

    var localnames = [],
        alternativs = alts || region.geodata.names.i18n,
        l;

    _.each(langs,function(lang){

      l = _.where(alts, {lang: lang.iso6391});
      if(!l) {
        l = _.where(alts, {lang: lang.iso6392});
      }

      if(l){
        _.each(l,function(n){
          localnames.push(n);
        });
      }
    });

    if(!localnames.length) {
      var name = _.find(alternativs,{name:result.name});
      if(name){
        localnames.push(name);
      } else {
        localnames.push({
          name: result.name
        });
      }
    }

    return localnames;

  };

  /*
   *
   */
  this.getWiki = function(result,region){

    var wiki = {},
        tags = {};
    wiki.url = [];

    if(region.properties && region.properties.tags) {
      tags = region.properties.tags;
      if(tags.wikidata) {
        wiki.wikidata = tags.wikidata;
      }
      if(tags.wikipedia) {
        wiki.wikipedia = tags.wikipedia;
      }
      if(result.wikipediaURL) {
        wiki.url.push(result.wikipediaURL);
      }
    }

    _.each(result.alternateNames,function(names){
      if(names.lang && names.lang === 'link') {
        if(names.name.indexOf('wiki') !== -1) {
          var link = names.name.replace('https://','');
          link = names.name.replace('http://','');
          wiki.url.push(link);
        }
      }
    });

    wiki.url = _.uniq(wiki.url);

    return wiki;

  };

  /**
  * Get JSON data from Geonames endpoints
  */
  this.get = function(type,params,callback) {

    if(typeof callback !== 'function') {
      throw('Callback must be a function');
    }

    var endpoint = this.url + '/' + type + 'JSON',
        query = params || {},
        options = {};

    query.username = this.username;

    options = {
      timeout: 10000,
      url: endpoint,
      qs: query
    };

    var req = request.get(options, function (error, response, body) {
      if(error){
        if(error.code === 'ETIMEDOUT'){
          console.log("Geonames: GET Timeout fired!");
        }
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
