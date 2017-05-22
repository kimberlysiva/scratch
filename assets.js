var express = require('express');
var fs = require('fs');

var router = express.Router();
var content = fs.readFileSync('.glitch-assets', 'utf8');
var str = content.split("\n").join(",\n");
var elems = JSON.parse('{"elems":[' + str + "{}]}").elems;
elems.pop(); // get rid of that last empty element

var myAssets = {};
for (var val of elems) {
    myAssets[val.uuid] = val;
}

//console.log(myAssets); 

router.use((request, response) => {
  response.header("Access-Control-Allow-Origin", "*");
  response.header("Access-Control-Allow-Methods", "GET");
  response.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  console.log(request.path);
  var name = request.path.substring(1); // get rid of leading /.  used to be encodeURIComponent(request.path) + '"';
  console.log(name)
  
  for (val in myAssets) {
      if (myAssets.hasOwnProperty(val)) {
        var e = myAssets[val];
        if (e.hasOwnProperty("name") && e.name === name) {
          var time = 0;
          if (e.hasOwnProperty("date")) {
            time = Date.parse(e.date);  
          }
          var url = e.url + "?" + time;          
          console.log(url);
          return response.redirect(url);          
        }          
      }
  }

  return response.sendStatus(404);    
});

module.exports = router;