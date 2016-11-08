var mysql = require("mysql");
var natural = require("natural");
var stringSimilarity = require('string-similarity');
var fs = require('fs');
var firebase = require("firebase");

// Initialize Firebase
var config = {
  apiKey: "AIzaSyB4MnNBOjsF82dodcOmf3siQYiztnflmxY",
  authDomain: "autocat-9a420.firebaseapp.com",
  databaseURL: "https://autocat-9a420.firebaseio.com",
  storageBucket: "autocat-9a420.appspot.com",
  messagingSenderId: "498380667941"
};

firebase.initializeApp(config);
// Get a reference to the database service
var database = firebase.database();
//initFirebase();

function initFirebase()
{
  database.ref("product_categories").set(null);
  database.ref("item_titles").set(null);
}

var obj = {
   product_categories: [],
   item_titles:{}
};

var pcatmap = {};


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
connection.query('SELECT * from product_categories order by parent_id, id', function(err, rows, fields) {
  if (!err)
  {
    console.log('# of categories fetched: ', rows.length);
    // for(var i=0; i<rows.length; i++)
    // {
    //   //console.log(rows[i].breadcrumb);
    //   targetCats.push(rows[i].title);

    //   //add data to obj.product_categories for generating JSON output to be imported into firebase
    //   obj.product_categories.push({ id:rows[i].id, 
    //                               title:rows[i].title, 
    //                               breadcrumb:rows[i].breadcrumb, 
    //                               parent_id:rows[i].parent_id,
    //                               tree_code:rows[i].tree_code,
    //                               is_leaf: rows[i].is_leaf
    //                             });
    // }

    cats = rows;
    createProductCategoryMap();
  }
  else
    console.log('Error while performing Query.');
});

//this is a conveneance function to process the category table and process it for importing into firebase
function createProductCategoryMap()
{
  for(var i=0; i<cats.length; i++)
  {
    var id = cats[i].id;
    var parent_id = cats[i].parent_id;
    
    //check if the parent node exists
    if(parent_id === 0)
    {
      var sub_cats = {};
      var sub_tree = {  id: String(cats[i].id), 
                        title: cats[i].title, 
                        breadcrumb: cats[i].breadcrumb, 
                        parent_id: String(cats[i].parent_id),
                        tree_code: cats[i].tree_code,
                        is_leaf: String(cats[i].is_leaf),
                        sub_cats: sub_cats
                      };
      pcatmap[id] = sub_tree;
    }
    //add the child under the parent
    else
    {
      var sub_tree = pcatmap[parent_id];
      if(sub_tree === undefined)
      {
        console.log(" *** Error in data table >> the parent_id is pointing to itself ****")
        console.log(cats[i]);
      }
      sub_tree.sub_cats[id] = {  id: String(cats[i].id), 
                        title: cats[i].title, 
                        breadcrumb: cats[i].breadcrumb, 
                        parent_id: String(cats[i].parent_id),
                        tree_code: cats[i].tree_code,
                        is_leaf: String(cats[i].is_leaf)
                      };

      // sub_tree.sub_cats.push({  id:cats[i].id, 
      //                   title:cats[i].title, 
      //                   breadcrumb:cats[i].breadcrumb, 
      //                   parent_id:cats[i].parent_id,
      //                   tree_code:cats[i].tree_code,
      //                   is_leaf: cats[i].is_leaf
      //                 });
    }
  }
  obj.product_categories = pcatmap;
}

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
      // obj.item_titles.push({  id:rows[i].id, 
      //                         title:rows[i].title, 
      //                         sku_code_from_channel:rows[i].sku_code_from_channel, 
      //                         company_id:rows[i].company_id,
      //                         number:rows[i].number,
      //                         category_id: -1
      //                       });

      obj.item_titles[rows[i].id] = {  id: String(rows[i].id), 
                              title: rows[i].title, 
                              sku_code_from_channel: rows[i].sku_code_from_channel, 
                              company_id: String(rows[i].company_id),
                              number: String(rows[i].number),
                              category_id: String(-1)
                            };
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