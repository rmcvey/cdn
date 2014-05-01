/**
*  Stand-alone image server, generates and caches thumbnails
*  to get up and running quickly, fill in config options with your own values and run: 
*    $ npm install
*    $ node cdn.js  
*    Then open your browser and go to:
*   http://localhost:6523/600x600/aHR0cDovL21zbmJjbWVkaWEzLm1zbi5jb20vai9tc25iYy9Db21wb25lbnRzL1Bob3Rvcy8wNzA4MDIvMDcwODAyX29yYW5ndXRhbl9obWVkXzEwYS5obWVkaXVtLmpwZw==
* 
*  @author Rob McVey
*  @license GPL-V2
*/
// customize the config object for your domain
var config = {
  // root directory of your project, cached images will be stored under here
  base_path: '/path/to/your/project/',
  // toggles console verbosity
  debug: false,
  // false if no SSL support, or uncomment object below and add your paths
  ssl: false,
  /*
  ssl: {
    key: '/path/to/ca.key',
    crt: '/path/to/ca.crt'
  },
  */
  // port to run cdn on
  port: 6523,
  // domains that you will accept images from
  whitelisted_domains: ['s3.amazonaws.com', 'lnkd.licdn.com', 'maps.googleapis.com','msnbcmedia3.msn.com'],
  // set to whatever you want
  default_dimensions: '100x100'
};


/**
*  main application code
*/
var express = require('express'),
    app      = express(),
    easyimg  = require('easyimage'),
    request  = require('request'),
    mime    = require('mime'),
    crypto  = require('crypto'),
    fs      = require('fs');

var cache_dir = config.base_path + '/cache/';

if(config.ssl){
  try {
    var privateKey   = fs.readFileSync(config.ssl.key).toString()
      , certificate  = fs.readFileSync(config.ssl.crt).toString()
      , credentials = crypto.createCredentials({key: privateKey, cert: certificate});
  } catch(e) {
    throw new Error("Invalid SSL configuration: " + e);
  }
}

if(!fs.existsSync(cache_dir)){
  throw new Error("Cache directory must be writeable: "+cache_dir);
}

// resize endpoint
app.get('/:dimensions/:url', function(req, res){
  // image dimensions (e.g. 500x500)
  var dim     = req.params.dimensions;
  // base64 encoded url
  var url     = req.params.url;
  // decode base64 url
  url          = new Buffer(url, 'base64').toString('ascii');
  
  var valid_types = ['png', 'gif', 'jpg', 'jpeg', 'ico', 'tiff', 'bmp', 'bin'];

  // only take a maximum of a subdomain and a domain from the target
  var url_domain  = url.split('/')[2].split('.').slice(-3).join('.');

  // only resize if the image comes from a whitelisted domain
  if(config.whitelisted_domains.indexOf(url_domain) !== -1) {
    // get the file name and extension
    var fname   = url.split('/').pop();
    var fext    = fname.split('.').pop();
    // create unique hash for requested url & dimensions
    var outname = crypto.createHash('md5').update(url+dim).digest('hex');
    var outpath = cache_dir + outname + '.' + fext;
    var action  = 'FAILED';

    if(valid_types.indexOf(fext.toLowerCase()) === -1 && ['lnkd.licdn.com','maps.googleapis.com'].indexOf(url_domain) === -1) {
      action = 'INVALID';
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({"error": 'Invalid or missing file extension'}));
    } else if(fs.existsSync(outpath)) { // file exists, serve cached thumbnail
      action = 'REQUEST';
      var mtype = mime.lookup(outpath);
      var data  = fs.readFileSync(outpath);
      res.setHeader('Content-Type', mtype);
      res.end(data, 'binary');
    } else { // generate new thumbnail
      var save_to  = '/tmp/'+fname;
      action = 'GENERATE';
      
      // request image
      request(url).pipe(fs.createWriteStream(save_to)).on('close', function(){
        var mtype = mime.lookup(outpath);
        var dimensions = dim || config.default_dimensions || '100x100';
        var split = dimensions.split('x');
        var w = parseInt(split[0]),
            h = parseInt(split[1]);
        
        if(!isNaN(w) && !isNaN(h)){
          // check default extension for file's actual mime-type, in case someone is being sneaky
          if(valid_types.indexOf(mime.extension(mtype)) === -1) {
            action = 'MIME_MISMATCH['+mtype+':'+mime.extension(mtype)+']';
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({"error": 'Mime type mismatch: '+action}));
          } else {
            try{
              easyimg.rescrop({
                  src: save_to, dst: outpath,
                  width: w, cropwidth: w, cropheight: h,
                  x: 0, y: 0
                },
                function(err, image) {
                  if (err) {
                    console.log('SYSEM ERROR GENERATING THUMB: %s', err);
                  }  else {
                    res.setHeader('Content-Type', mtype);
                    res.end(fs.readFileSync(outpath), 'binary');
                  }
              });
            } catch(e) {
              action = 'ERROR';
              fname = e;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({"error": e}));
            }
          }
        }
      });
    }
  } else {
    action   = 'ERROR';
    fname    = 'INVALID_URL_DOMAIN';
    dim      = url_domain;
    outname  = '';
    var outpath = config.base_path + '/rtio/img/not_found.gif';
    var mtype = mime.lookup(outpath);
    var data  = fs.readFileSync(outpath);
    res.setHeader('Content-Type', mtype);
    res.end(fs.readFileSync(outpath), 'binary');
  }
  // log all requests
  log_request(
    new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''),
    action,
    req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    req.headers.referer || 'None',
    fname,
    dim,
    outname
  );
});

function log_request(action, date, ip, ref, file, dimensions, out_file){
  console.log('[%s]  %s  %s  %s  %s  %s  %s', action, date, ip, ref, file, dimensions, out_file);
}

if(config.ssl){
  app.setSecure(credentials);
}
app.listen(config.port);
