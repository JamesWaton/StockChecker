/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

var expect = require('chai').expect;
let mongodb = require('mongodb')
let mongoose = require('mongoose')
//to connect the xml file
let XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest

//var MongoClient = require('mongodb');


//const CONNECTION_STRING = process.env.DB; //MongoClient.connect(CONNECTION_STRING, function(err, db) {});

module.exports = function (app) {
// connecting to monogDB 
  let uri = 'mongodb+srv://user1:' + process.env.PW + '@freecodecamp.mhmy9.mongodb.net/stock_price_check?retryWrites=true&w=majority'
  
  mongoose.connect(uri, {useNewUrlParser: true, useUnifiedTopology: true })
  
  //make skema to represent stocks i only need these. Using ip so they cant like twice
  let stockSchema = new mongoose.Schema({
  name: {type: String, required: true},
	likes: {type: Number, default: 0},
	ips: [String]
  })
  
  let Stock = mongoose.model('Stock', stockSchema)
  
app.route('/api/stock-prices')
.get(function (req, res){
  //this is what will come back in a jason
    let responseObject = {}
    //for all the stock information 
    responseObject['stockData'] = {}

		// Variable to determine number of stocks 1 stock or two stocks
    let twoStocks = false
  
    /* Output Response */
    let outputResponse = () => {
        return res.json(responseObject)
    }
    
    /* Find/Update Stock Document to mainly set the number if likes*/
    let findOrUpdateStock = (stockName, documentUpdate, nextStep) => {
      Stock.findOneAndUpdate(
          {name: stockName},
        //document updating as its defult emty
          documentUpdate,
        //upsert creats stock if it doesn't already exsit in the database
          {new: true, upsert: true},
          (error, stockDocument) => {
              if(error){
              console.log(error)
              }else if(!error && stockDocument){
                  if(twoStocks === false){
                    return nextStep(stockDocument, processOneStock)
                  }else{
                    return nextStep(stockDocument, processTwoStocks)
                  }
              }
          }
      )
      
    }
    
    /* Like Stock to increment likes by one then add ip address*/
    let likeStock = (stockName, nextStep) => {
      Stock.findOne({name: stockName}, (error, stockDocument) => {
        //first check ip address to see if it has been used yet
        if(!error && stockDocument && stockDocument['ips'] && stockDocument['ips'].includes(req.ip)){
          //if already there
            return res.json('Error: Only 1 Like per IP Allowed')
        }else{                                             //pushing to ip array
            let documentUpdate = {$inc: {likes: 1}, $push: {ips: req.ip}}
            nextStep(stockName, documentUpdate, getPrice)
        }
    })
    }
    
    
/* Get Price */
let getPrice = (stockDocument, nextStep) => {
  let xhr = new XMLHttpRequest()
  // this is the one free code camp provides
  let requestUrl = 'https://stock-price-checker-proxy--freecodecamp.repl.co/v1/stock/' + stockDocument['name'] + '/quote'
  //setting the arguments i need
  xhr.open('GET', requestUrl, true)
  //once completed 
  xhr.onload = () => {
    // making it JSON
      let apiResponse = JSON.parse(xhr.responseText)
      //collecting real time price 
      stockDocument['price'] = apiResponse['latestPrice'].toFixed(2)
      nextStep(stockDocument, outputResponse)
  }
  xhr.send()
}

    
    /* Build Response for 1 Stock  */
    let processOneStock = (stockDocument, nextStep) => {
      //name is created from the request query
      responseObject['stockData']['stock'] = stockDocument['name']
      responseObject['stockData']['price'] = stockDocument['price']
      responseObject['stockData']['likes'] = stockDocument['likes']
      nextStep()  
      
    }
    // contain two seperate objects
    let stocks = []        
        /* Build Response for 2 Stocks */
        let processTwoStocks = (stockDocument, nextStep) => {
          let newStock = {}
          newStock['stock'] = stockDocument['name']
          newStock['price'] = stockDocument['price']
          newStock['likes'] = stockDocument['likes']
          stocks.push(newStock)
          //checking if we have reacieved both stocks
          if(stocks.length === 2){
            stocks[0]['rel_likes'] = stocks[0]['likes'] - stocks[1]['likes']
            stocks[1]['rel_likes'] = stocks[1]['likes'] - stocks[0]['likes']
            responseObject['stockData'] = stocks
            nextStep()
          }else{
            return
          }
        }

		/* Process Input*/  
    if(typeof (req.query.stock) === 'string'){
      /*Getting the One Stock */
        let stockName = req.query.stock
        
        //making empty object for filling
           let documentUpdate = {}
           //checking if there is a like already
                if(req.query.like && req.query.like === 'true'){
                    likeStock(stockName, findOrUpdateStock)
                }else{
                    let documentUpdate = {}
                    findOrUpdateStock(stockName, documentUpdate, getPrice)
                }
  
      //for when theres two stocks 
    } else if (Array.isArray(req.query.stock)){
			twoStocks = true
       /* Stock 1 */
    let stockName = req.query.stock[0]
    if(req.query.like && req.query.like === 'true'){
        likeStock(stockName, findOrUpdateStock)
    }else{
        let documentUpdate = {}
        findOrUpdateStock(stockName, documentUpdate, getPrice)
    }

    /* Stock 2 */
    stockName = req.query.stock[1]
    if(req.query.like && req.query.like === 'true'){
        likeStock(stockName, findOrUpdateStock)
    }else{
        let documentUpdate = {}
        findOrUpdateStock(stockName, documentUpdate, getPrice)
    }



    }
});
};