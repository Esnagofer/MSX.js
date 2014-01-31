var fs = require('fs')
  , parse = require('url').parse
  , path = require('path')
  , normalize = path.normalize
  , sep = path.sep
  , join = path.join
  , http = require('http')
  , connect = require('connect');

function directory(root) {
  // root required
  if (!root) throw new Error('directory() root path required');
  var root = normalize(root + sep);

  return function directory(req, res, next) {
    if ('GET' != req.method && 'HEAD' != req.method) return next();

    var url = parse(req.url)
      , dir = decodeURIComponent(url.pathname)
      , path = normalize(join(root, dir));

    // null byte(s), bad request
    if (~path.indexOf('\0')) return next(utils.error(400));

    // malicious path, forbidden
    if (0 != path.indexOf(root)) return next(utils.error(403));

    // check if we have a directory
    fs.stat(path, function(err, stat){
      if (err) return 'ENOENT' == err.code
        ? next()
        : next(err);

      if (!stat.isDirectory()) return next();

      // fetch files
      fs.readdir(path, function(err, files){
        if (err) return next(err);
        files = removeHidden(files);
        files.sort();
        html(req, res, files, next);
      });
    });
  };
};

function removeHidden(files) {
  return files.filter(function(file){
    return '.' != file[0];
  });
}

function html(req, res, files, next) {
  var str = '<html><body><table>\n';

  for(var i=0; i<5; i++) {
    str = str + '<tr><td><a href="#">-</a></td></tr>\n';
  }

  for(i in files) {
    str = str + '<tr><td><a href="' + files[i] + '">' + files[i] + '</a></td></tr>\n';
  }

  str = str + '</table></body></html>';
  res.end(str);
}

var app = connect()
          //.use(connect.logger('dev'))
          .use(connect.static(__dirname))
          //.use(connect.directory(__dirname))
          .use(directory(__dirname));

http.createServer(app).listen(4000);
console.log('Server listenning on port 4000...');
