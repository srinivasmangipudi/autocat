var mysql = require("mysql");
var natural = require("natural");
var stringSimilarity = require('string-similarity');
var fs = require('fs');

var obj = {
   product_categories: [],
   item_titles:[]
};

// set the local databse connection
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'root',
  database : 'bt_local'
});

connection.connect(function(err){
  if(err){
    console.log('Error connecting to Db');
    return;
  }
  console.log('Connection established');
});

//get all the product categories
var cats = null;
var targetCats = [];
connection.query('SELECT * from product_categories', function(err, rows, fields) {
  if (!err)
  {
    console.log('# of categories fetched: ', rows.length);
    for(var i=0; i<rows.length; i++)
    {
      //console.log(rows[i].breadcrumb);
      targetCats.push(rows[i].title);

      //add data to obj.product_categories for generating JSON output to be imported into firebase
      obj.product_categories.push({ id:rows[i].id, 
                                  title:rows[i].title, 
                                  breadcrumb:rows[i].breadcrumb, 
                                  parent_id:rows[i].parent_id,
                                  tree_code:rows[i].tree_code,
                                  is_leaf: rows[i].is_leaf
                                });
    }

    cats = rows;
  }
  else
    console.log('Error while performing Query.');
});

//get all the skus
var skus = null;
connection.query('SELECT * from skus', function(err, rows, fields) {
  if (!err)
  {
    console.log('# of skus fetched: ', rows.length);
    // console.log('All skus:');
    // for(var i=0; i<rows.length; i++)
    // {
    //   console.log(rows[i]);
    // }

    skus = rows;

    //due to the async nature, call the procesSkus func now when the data is loaded.
    //process();
  }
  else
    console.log('Error while performing Query.');
});

//get all the item_titles
var itemTitles = null;
connection.query('SELECT * from item_titles', function(err, rows, fields) {
  if (!err)
  {
    console.log('# of items fetched: ', rows.length);
    for(var i=0; i<rows.length; i++)
    {
      //console.log(rows[i]);
      //add data to obj.item_titles for generating JSON output to be imported into firebase
      obj.item_titles.push({  id:rows[i].id, 
                              title:rows[i].title, 
                              sku_code_from_channel:rows[i].sku_code_from_channel, 
                              company_id:rows[i].company_id,
                              number:rows[i].number,
                              category_id: -1
                            });

    }

    itemTitles = rows;

    //due to the async nature, call the procesSkus func now when the data is loaded.
    process();
  }
  else
    console.log('Error while performing Query.');
});


/** 
    --- various processing functions
**/
function process()
{
  generateJSONFileForFirebase();
  //StringSimilarityMatchingAll();
  //JaroWinklerDistanceMatching();
}

function StringSimilarityMatchingOne()
{
  var ratings = stringSimilarity.findBestMatch(skus[0].readable_name, targetCats);
  console.log(ratings);

  console.log("\n StringSimilarity Best match for: " + skus[0].readable_name + " is - " + ratings.bestMatch.target);
}

function StringSimilarityMatchingAll()
{
  for(var i=0; i<itemTitles.length; i++)
  {
    var ratings = stringSimilarity.findBestMatch(itemTitles[i].title, targetCats);
    //console.log(ratings);
    //if(ratings.bestMatch.rating >= 0.4)
      console.log("\n StringSimilarity Best match for: " + itemTitles[i].title + " is - " + ratings.bestMatch.target + " - rating: " + ratings.bestMatch.rating);
  }
}

function JaroWinklerDistanceMatching()
{
  var bestMatch = 0;
  var bestMatchIdx = 0;

  for(var i=0; i<cats.length; i++)
  {
    var match = natural.JaroWinklerDistance(cats[i].breadcrumb, skus[0].readable_name);
    console.log("JaroWinkler Distance between strings >> " + cats[i].title + " -- " + skus[0].readable_name + " is equal to: " + match);
    //console.log(natural.JaroWinklerDistance(cats[i].breadcrumb, skus[0].readable_name));

    if(match > bestMatch)
    {
      bestMatch = match;
      bestMatchIdx = i;
    } 
  } 

  console.log("\n The best match found for " + skus[0].readable_name + " is the product category: " + cats[bestMatchIdx].breadcrumb);
}

function generateJSONFileForFirebase()
{
  var json = JSON.stringify(obj);
  fs.writeFile('bt_cat_data_for_fb.json', json, 'utf8');

  console.log('Generated JSON File');
}

matchToken("temp");
function matchToken(token)
{
  console.log("match token called with token: " + token);
}

connection.end(function(err) {
  // The connection is terminated gracefully
  // Ensures all previously enqueued queries are still
  // before sending a COM_QUIT packet to the MySQL server.
});