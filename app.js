const io = require("socket.io-client");
const socketioForServer = require("socket.io");
const express = require("express");
const http = require("http");
const app = express();
const PORT = process.env.PORT || 2020;
const server = http.createServer(app);
const mysql = require("mysql");

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
  });
});

// Harem altından yayını dinlemek için socket bağlantısı
const ioClient = io("wss://api.haremaltin.com:443", {
  transports: ["websocket"],
});

ioClient.on("connect", () => {
  ioClient.on("price_changed", (data) => {
    if (data && data["data"] && data["data"]["ALTIN"]) {
      let has = data["data"]["ALTIN"];
      const sqlQuery = "SELECT * FROM prices";
      const sqlUpdate =
        "UPDATE prices SET buyPrice = ?, salePrice = ? WHERE id = ?";

      dbConnection.query(sqlQuery, (err, results) => {
        if (err) {
          console.error("Error executing SQL query:", err);
          return;
        }
        let updatedData = {
          gold: [],
          currency: [],
        };
        results.forEach((result) => {
          if (result.class == "gold") {
            result.buyPrice =
              parseFloat(result.saleFactor) * parseFloat(has["alis"]);
            result.sellPrice =
              parseFloat(result.saleFactor) * parseFloat(has["satis"]);
            updatedData.gold.push(result);
          } else {
            if (data["data"][result.code]) {
              result.salePrice =
                result.saleFactor + data["data"][result.code]["satis"];
              result.buyPrice =
                result.buyFactor + data["data"][result.code]["alis"];


                updatedData.currency.push(result);


            } else {
              // Handle the case when the currency data is not available
            }
          }
        });

        updatedData.gold.forEach((updatedResult) => {
          dbConnection.query(
            sqlUpdate,
            [updatedResult.buyPrice, updatedResult.sellPrice, updatedResult.id],
            (err, updateResults) => {
              if (err) {
              } else {
              }
            }
          );
        });

        updatedData.currency.forEach((updatedResult) => {
          dbConnection.query(
            sqlUpdate,
            [updatedResult.buyPrice, updatedResult.sellPrice, updatedResult.id],
            (err, updateResults) => {
              if (err) {
                console.log(err);
              } else {
                console.log(updateResults);
              }
            }
          );
        });

        ioServer.emit("new", updatedData);
      });
    } else {
      console.log("ALTIN verisi boş veya tanımsız.");
    }
  });
});

ioClient.on("message", (data) => {
  console.log("Sunucudan gelen mesaj:", data);
});

ioClient.on("connect_error", (error) => {
  console.error("Bağlantı hatası:", error);
});

ioClient.on("disconnect", () => {
  console.log("Bağlantı kesildi");
});
