/**
 * GOOGLE APPS SCRIPT - BACKEND API UNTUK MBOKDE MART (VERSI UPDATE + FIX HILANG NOL DI NO WA)
 * 
 * Petunjuk Baru:
 * 1. Buka kembali editor Apps Script Anda.
 * 2. Salin seluruh kode di bawah ini, lalu timpa (replace) seluruh kode lama Anda.
 * 3. Simpan proyek (💾).
 * 
 * CARA REDEPLOY SETELAH UPDATE:
 * - Klik "Terapkan" (Deploy) -> "Kelola Penerapan" (Manage Deployments).
 * - Klik ikon Pensil edit pada penerapannya.
 * - Pada versi (Version), pilih "Versi baru" (New Version).
 * - Klik "Terapkan" (Deploy).
 */

function doGet(e) {
  const sheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const ss = SpreadsheetApp.openById(sheetId);
  const action = e.parameter.action;
  
  if (action === "getProducts") {
    const sheet = ss.getSheetByName("Produk");
    const data = sheet.getDataRange().getValues();
    const products = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      let variants = [];
      try {
        variants = JSON.parse(row[5]);
      } catch (err) {
        variants = [{ name: "Standard", price: Number(row[3]) }];
      }

      const images = String(row[2]).split(",").map(url => url.trim());

      products.push({
        id: String(row[0]),
        name: String(row[1]),
        images: images,
        category: String(row[3]),
        desc: String(row[4]),
        variants: variants,
        badge: String(row[6])
      });
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", data: products }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  else if (action === "getOrders") {
    let waNumber = e.parameter.whatsapp;
    if (!waNumber) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "WhatsApp number required" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Standardisasi nomor WA menggunakan helper cleanWa
    const cleanSearchWa = cleanWa(waNumber);

    const sheet = ss.getSheetByName("Pesanan");
    const data = sheet.getDataRange().getValues();
    const matchedOrders = [];

    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      if (!row[0]) continue;
      
      let rowWa = String(row[3]).trim();
      
      // Menggunakan pencocokan toleran yang sangat tangguh (country code +62/0/87...)
      if (cleanWa(rowWa) === cleanSearchWa) {
            
        let items = [];
        try {
          items = JSON.parse(row[12]);
        } catch(e) {
          items = [];
        }

        matchedOrders.push({
          id: String(row[0]),
          date: String(row[1]),
          customerName: String(row[2]),
          customerWhatsapp: rowWa,
          customerAddress: String(row[4]),
          latitude: Number(row[5]),
          longitude: Number(row[6]),
          shippingMethod: String(row[7]),
          shippingCost: Number(row[8]),
          subtotal: Number(row[9]),
          total: Number(row[10]),
          paymentMethod: String(row[11]),
          items: items,
          status: String(row[13])
        });
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", data: matchedOrders }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  else if (action === "getAllOrders") {
    const sheet = ss.getSheetByName("Pesanan");
    const data = sheet.getDataRange().getValues();
    const allOrders = [];

    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      if (!row[0]) continue;
      
      let items = [];
      try {
        items = JSON.parse(row[12]);
      } catch(e) {
        items = [];
      }

      allOrders.push({
        id: String(row[0]),
        date: String(row[1]),
        customerName: String(row[2]),
        customerWhatsapp: String(row[3]),
        customerAddress: String(row[4]),
        latitude: Number(row[5]),
        longitude: Number(row[6]),
        shippingMethod: String(row[7]),
        shippingCost: Number(row[8]),
        subtotal: Number(row[9]),
        total: Number(row[10]),
        paymentMethod: String(row[11]),
        items: items,
        status: String(row[13])
      });
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", data: allOrders }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const sheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const ss = SpreadsheetApp.openById(sheetId);
  
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;

    if (action === "createOrder") {
      const sheet = ss.getSheetByName("Pesanan");
      const order = postData.order;
      const itemsString = JSON.stringify(order.items);
      
      // FIX UTAMA: Paksa no WhatsApp disimpan sebagai text biasa dengan awalan tanda petik satu (') 
      // sehingga Google Sheets TIDAK menghapus angka nol di depan (misal: '087...)
      const waText = "'" + String(order.customerWhatsapp).trim();

      sheet.appendRow([
        order.id,
        order.date,
        order.customerName,
        waText,                       // Kolom D: WhatsApp (Dipaksa jadi teks teks)
        order.customerAddress,
        order.latitude,
        order.longitude,
        order.shippingMethod,
        order.shippingCost,
        order.subtotal,
        order.total,
        "",
        itemsString,
        order.status
      ]);

      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Order created successfully" }))
        .setMimeType(ContentService.MimeType.JSON);
    } 
    
    else if (action === "updatePayment") {
      const sheet = ss.getSheetByName("Pesanan");
      const orderId = postData.orderId;
      const paymentMethod = postData.paymentMethod;
      const status = postData.status;

      const data = sheet.getDataRange().getValues();
      let rowUpdated = false;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(orderId)) {
          sheet.getRange(i + 1, 12).setValue(paymentMethod);
          sheet.getRange(i + 1, 14).setValue(status);
          rowUpdated = true;
          break;
        }
      }

      if (rowUpdated) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Payment updated successfully" }))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Order ID not found" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    else if (action === "updateOrderStatus") {
      const sheet = ss.getSheetByName("Pesanan");
      const orderId = postData.orderId;
      const status = postData.status;

      const data = sheet.getDataRange().getValues();
      let rowUpdated = false;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(orderId)) {
          sheet.getRange(i + 1, 14).setValue(status);
          rowUpdated = true;
          break;
        }
      }

      if (rowUpdated) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Order status updated by seller" }))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Order ID not found" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    else if (action === "saveProduct") {
      const sheet = ss.getSheetByName("Produk");
      const product = postData.product;
      const data = sheet.getDataRange().getValues();
      let rowUpdated = false;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(product.id)) {
          sheet.getRange(i + 1, 2).setValue(product.name);
          sheet.getRange(i + 1, 3).setValue(product.images.join(', '));
          sheet.getRange(i + 1, 4).setValue(product.category);
          sheet.getRange(i + 1, 5).setValue(product.desc);
          sheet.getRange(i + 1, 6).setValue(JSON.stringify(product.variants));
          sheet.getRange(i + 1, 7).setValue(product.badge);
          rowUpdated = true;
          break;
        }
      }

      if (!rowUpdated) {
        sheet.appendRow([
          product.id,
          product.name,
          product.images.join(', '),
          product.category,
          product.desc,
          JSON.stringify(product.variants),
          product.badge
        ]);
      }

      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Product saved successfully" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    else if (action === "deleteProduct") {
      const sheet = ss.getSheetByName("Produk");
      const productId = postData.productId;
      const data = sheet.getDataRange().getValues();

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(productId)) {
          sheet.deleteRow(i + 1);
          return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Product deleted successfully" }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }

      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Product not found" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    else if (action === "uploadImage") {
      const base64Data = postData.base64Data;
      const fileName = postData.fileName;
      const mimeType = postData.mimeType;
      
      const decoded = Utilities.base64Decode(base64Data);
      const blob = Utilities.newBlob(decoded, mimeType, fileName);
      
      let folder;
      const folderId = postData.folderId || ""; 
      if (folderId && folderId !== "") {
        folder = DriveApp.getFolderById(folderId);
      } else {
        folder = DriveApp.getRootFolder();
      }
      
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      const fileId = file.getId();
      const directUrl = "https://drive.google.com/uc?export=download&id=" + fileId;
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success", url: directUrl }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid action" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function initializeDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  let sheetProduk = ss.getSheetByName("Produk");
  if (!sheetProduk) {
    sheetProduk = ss.insertSheet("Produk");
  } else {
    sheetProduk.clear();
  }
  
  sheetProduk.appendRow(["ID", "Nama", "Gambar", "Kategori", "Deskripsi", "Varian", "Badge"]);
  
  const defaultProducts = [
    [
      "p1",
      "Bayam Hijau Organik",
      "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=500&auto=format&fit=crop&q=80, https://images.unsplash.com/photo-1551308990-2f1643841448?w=500&auto=format&fit=crop&q=80",
      "daun",
      "Bayam hijau segar pilihan yang ditanam secara organik tanpa pestisida kimia. Kaya zat besi, kalsium, dan vitamin A. Sangat baik untuk masakan sayur bening keluarga.",
      JSON.stringify([
        { name: "1 Ikat Besar", price: 4500, label: "Populer" },
        { name: "3 Ikat (Bundle)", price: 12000, label: "Promo Rp12rb" },
        { name: "1 Kg (Grosir)", price: 20000, label: "Hemat Banyak" }
      ]),
      "Organik"
    ],
    [
      "p2",
      "Tomat Merah Ranum",
      "https://images.unsplash.com/photo-1595855759920-86582396756a?w=500&auto=format&fit=crop&q=80, https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop&q=80",
      "buah",
      "Tomat merah segar dipetik matang pohon. Rasa manis-asam menyegarkan, padat dagingnya, dan kaya antioksidan likopen. Bagus untuk jus atau pelengkap tumis sop.",
      JSON.stringify([
        { name: "500 gram", price: 6500, label: "" },
        { name: "1 Kg", price: 12000, label: "Bestseller" },
        { name: "2 Kg (Dus)", price: 22000, label: "Hemat Rp2rb" }
      ]),
      "Segar"
    ],
    [
      "p3",
      "Cabai Rawit Merah Brebes",
      "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=500&auto=format&fit=crop&q=80, https://images.unsplash.com/photo-1564683214966-263a23a7fca5?w=500&auto=format&fit=crop&q=80",
      "bumbu",
      "Cabai rawit merah pedas Brebes berkualitas tinggi. Pedas nendang maksimal, kulit cabai mengkilap, dan dijamin bebas dari kebusukan. Cocok untuk aneka sambal dahsyat.",
      JSON.stringify([
        { name: "100 gram", price: 7500, label: "" },
        { name: "250 gram", price: 18000, label: "Promo Rp18rb" },
        { name: "1 Kg", price: 65000, label: "Grosir" }
      ]),
      "Pedas!"
    ],
    [
      "p4",
      "Bawang Putih Kating Pilihan",
      "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500&auto=format&fit=crop&q=80, https://images.unsplash.com/photo-1583845946123-dc132549a1d2?w=500&auto=format&fit=crop&q=80",
      "bumbu",
      "Bawang putih kating impor dengan ukuran siung besar, padat, dan beraroma wangi sangat harum. Menjadikan tumisan masakan keluarga Anda berkali lipat lebih lezat.",
      JSON.stringify([
        { name: "250 gram", price: 7500, label: "" },
        { name: "500 gram", price: 14000, label: "Terlaris" },
        { name: "1 Kg", price: 27000, label: "Hemat Rp1rb" }
      ]),
      "Wangi"
    ],
    [
      "p5",
      "Bawang Merah Brebes Asli",
      "https://images.unsplash.com/photo-1618220179428-22790b461013?w=500&auto=format&fit=crop&q=80, https://images.unsplash.com/photo-1604152135912-04a022e23696?w=500&auto=format&fit=crop&q=80",
      "bumbu",
      "Bawang merah asli Brebes dengan kadar air rendah, rasa gurih-manis alami, dan tekstur yang sangat renyah saat digoreng. Penambah selera makan masakan harian.",
      JSON.stringify([
        { name: "250 gram", price: 8500, label: "" },
        { name: "500 gram", price: 16500, label: "Bestseller" },
        { name: "1 Kg", price: 32000, label: "Hemat Rp1rb" }
      ]),
      "Pilihan"
    ],
    [
      "p6",
      "Wortel Manis Madu Lokal",
      "https://images.unsplash.com/photo-1598170845058-32b996a6bd41?w=500&auto=format&fit=crop&q=80, https://images.unsplash.com/photo-1582515073490-39981397c445?w=500&auto=format&fit=crop&q=80",
      "buah",
      "Wortel manis madu lokal hasil kebun pegunungan. Rasa manis alami tanpa getir pahit, renyah, segar, kaya vitamin A. Sangat disukai anak-anak untuk jus atau campuran sop ceker.",
      JSON.stringify([
        { name: "500 gram", price: 5000, label: "" },
        { name: "1 Kg", price: 9000, label: "Bestseller" },
        { name: "2 Kg (Paket)", price: 17000, label: "Hemat Rp1rb" }
      ]),
      "Manis"
    ],
    [
      "p7",
      "Kubis / Kol Putih Garing",
      "https://images.unsplash.com/photo-1581074817533-036294e58043?w=500&auto=format&fit=crop&q=80, https://images.unsplash.com/photo-1622484211148-71649992c68f?w=500&auto=format&fit=crop&q=80",
      "daun",
      "Kubis segar padat rapat berdaun garing manis. Bersih bebas ulat, segar tahan lama di kulkas. Sempurna untuk hidangan kol tumis orak-arik telur atau lalapan sambal pecel.",
      JSON.stringify([
        { name: "1 Bonggol Kecil", price: 4000, label: "" },
        { name: "1 Bonggol Besar", price: 7000, label: "Terlaris" }
      ]),
      "Garing"
    ],
    [
      "p8",
      "Beras Pandan Wangi Organik",
      "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80, https://images.unsplash.com/photo-1536304997881-a372c179924b?w=500&auto=format&fit=crop&q=80",
      "sembako",
      "Beras Pandan Wangi murni hasil tani bebas pengawet atau pemutih kimia berbahaya. Menghasilkan nasi super pulen maksimal dan beraroma wangi pandan alami yang sangat memikat.",
      JSON.stringify([
        { name: "1 kg", price: 15000, label: "" },
        { name: "5 Kg (Pack)", price: 68000, label: "Paling Hemat" }
      ]),
      "Premium"
    ]
  ];
  
  defaultProducts.forEach(prod => sheetProduk.appendRow(prod));

  let sheetPesanan = ss.getSheetByName("Pesanan");
  if (!sheetPesanan) {
    sheetPesanan = ss.insertSheet("Pesanan");
  } else {
    sheetPesanan.clear();
  }
  
  sheetPesanan.appendRow([
    "ID Pesanan", 
    "Tanggal", 
    "Nama Penerima", 
    "WhatsApp", 
    "Alamat", 
    "Latitude", 
    "Longitude", 
    "Metode Kurir", 
    "Ongkir", 
    "Subtotal", 
    "Total Bayar", 
    "Metode Bayar", 
    "Item Detail", 
    "Status"
  ]);

  Logger.log("Database Mbokde Mart Sukses Diinisialisasi!");
}

// HELPER PEMBERSIH & NORMALISASI NOMOR WA
function cleanWa(num) {
  let clean = String(num).replace(/[^0-9]/g, '').trim();
  // Hilangkan kode negara 62 di depan jika ada
  if (clean.indexOf('62') === 0) {
    clean = clean.substring(2);
  }
  // Hilangkan angka 0 di depan jika ada
  if (clean.indexOf('0') === 0) {
    clean = clean.substring(1);
  }
  return clean;
}
