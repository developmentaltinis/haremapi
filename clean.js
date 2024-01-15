const io = require("socket.io-client");
const express = require("express");
const http = require("http");
const app = express();
const mysql = require("mysql");
const server = http.createServer(app);
const PORT = 2020;
//SOCKETIO FOR SERVER
const socketioForServer = require("socket.io");
// VueJS tarafına yayın yapmak için socket server
const ioServer = socketioForServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
  },
});

// Serverin ayağa kaldırılması
server.listen(PORT, () => {
  // Servere bağlananların dinlenmesi
  ioServer.on("connection", (socket) => {
    console.log(socket.id);
    ioServer.emit("merhaba", "Yeni biri bağlandı! Hoş geldin!");
  });
});

// Mysql ayarlaması
const dbConnection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "187162Emir.",
  database: "laravel",
});

// Mysql bağlantı işlemi
dbConnection.connect((err) => {
  if (err) {
    console.error("MySQL connection error:", err);
    return;
  }
  console.log("Connected to MySQL database");
});
const sqlQuery = `SELECT
prices.id,
prices.code,
prices.saleOperator,
prices.buyOperator,
prices.info,
prices.shortName,
CAST(prices.salePrice AS DECIMAL(10,3)) AS salePrice,
CAST(prices.saleFactor AS DECIMAL(10,3)) AS saleFactor,
CAST(prices.buyPrice AS DECIMAL(10,3)) AS buyPrice,
CAST(prices.buyFactor AS DECIMAL(10,3)) AS buyFactor,
prices.product_id,
prices.class,
prices.created_at,
prices.updated_at,
JSON_OBJECT(
  'id', products.id,
  'name', products.name,
  'parent_id', products.parent_id,
  'api_id', products.api_id,
  'classes', products.classes,
  'isJunk', products.isJunk,
  'barcodeStatus', products.barcodeStatus,
  'barcodePrefix', products.barcodePrefix,
  'maxDiscountBuy', CAST(products.maxDiscountBuy AS DECIMAL(10,2)),
  'maxDiscountSale', CAST(products.maxDiscountSale AS DECIMAL(10,2)),
  'shortName', products.shortName,
  'created_at', products.created_at,
  'updated_at', products.updated_at
  ) AS product
FROM prices
JOIN products ON prices.product_id = products.id;`;

const sqlQueryForRates = "SELECT * FROM pScreen_Card_Rates";
const sqlQueryForBanks = "SELECT * FROM banks";

const sqlUpdate = "UPDATE prices SET buyPrice = ?, salePrice = ? WHERE id = ?";
// Harem altından yayını dinlemek için socket bağlantısı
const ioClient = io("wss://api.haremaltin.com:443", {
  transports: ["websocket"],
});
let rates = [];
let banks = [];
ioClient.on("connect", () => {
  ioClient.on("price_changed", (socketData) => {
    let socketDovizData = socketData["data"];
    let sqlData = [];
    dbConnection.query(sqlQuery, (err, data) => {
      if (err) {
        return;
      }

      dbConnection.query(sqlQueryForRates, (err, data) => {
        rates = data;
      });

      dbConnection.query(sqlQueryForBanks, (err, data) => {
        banks = data;
      });

      sqlData = data;

      sqlData.forEach((element) => {
        if (element.class == "gold") {
          let hasAltin = socketData["data"]["ALTIN"];
          if (hasAltin) {
            let newSellPrice = 0;
            let newBuyPrice = 0;

            switch (element.saleOperator) {
              case "+":
                newSellPrice =
                  parseFloat(hasAltin["satis"]) +
                  parseFloat(element.saleFactor);
                break;
              case "*":
                newSellPrice =
                  parseFloat(hasAltin["satis"]) *
                  parseFloat(element.saleFactor);
                break;
              case "-":
                newSellPrice =
                  parseFloat(hasAltin["satis"]) -
                  parseFloat(element.saleFactor);
                break;
              case "/":
                newSellPrice =
                  parseFloat(hasAltin["satis"]) /
                  parseFloat(element.saleFactor);
                break;
              default:
                console.error("Geçersiz operatör: " + element.saleOperator);
                break;
            }

            switch (element.buyOperator) {
              case "+":
                newBuyPrice =
                  parseFloat(hasAltin["alis"]) + parseFloat(element.buyFactor);
                break;
              case "*":
                newBuyPrice =
                  parseFloat(hasAltin["alis"]) * parseFloat(element.buyFactor);
                break;
              case "-":
                newBuyPrice =
                  parseFloat(hasAltin["alis"]) - parseFloat(element.buyFactor);
                break;
              case "/":
                newBuyPrice =
                  parseFloat(hasAltin["alis"]) / parseFloat(element.buyFactor);
                break;
              default:
                console.error("Geçersiz operatör: " + element.buyOperator);
                break;
            }

            dbConnection.query(
              sqlUpdate,
              [newBuyPrice, newSellPrice, element.id],
              (err, updateResults) => {
                if (err) {
                  console.error(err);
                } else {
                }
              }
            );
          }
        } else {
          console.log("döviz");
        }
      });

      dbConnection.query(sqlQuery, (err, data) => {
        ioServer.emit("new", { data: data, rates: rates, banks: banks });
      });
    });
  });
});
