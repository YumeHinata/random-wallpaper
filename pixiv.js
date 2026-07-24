const imageContainer =
    document.getElementById("image-container");

imageContainer.addEventListener("click", () => {

    if (!currentPixivUrl) {

        showNotification("当前图片没有 Pixiv 信息");

        return;

    }

    window.open(currentPixivUrl, "_blank");

});