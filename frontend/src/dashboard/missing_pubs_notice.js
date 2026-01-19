/**
 * Utilities to handle the "missing publications" notice card.
 */

/**
 * Show or hide the "missing publications" notice.
 *
 * @param {object} params
 * @param {HTMLElement|null} params.noticeEl
 * @param {HTMLElement|null} params.noticeTextEl
 * @param {boolean} params.visible
 * @param {() => string} params.detectLang
 * @returns {void}
 */
export function setMissingPubsNoticeVisible({
    noticeEl,
    noticeTextEl,
    visible,
    detectLang,
}) {
    if (!noticeEl || !noticeTextEl) return;

    if (visible) {
        const lang = detectLang();
        const concienciaURL = 'https://apps3.csic.es/contcien/';
        const contactEmail = 'bioinformatica@ipb.csic.es';
        const textEs = `¿No encuentras una de tus publicaciones? Asegúrate de tenerla registrada en <a href="${concienciaURL}" target="_blank" rel="noopener">Conciencia</a>. Si ya la tienes publicada allí y sigues sin verla aquí, espera a que actualicemos nuestro sistema. Si tienes prisa, puedes contactar con la Unidad de Bioinformática del IPBLN en <a href="mailto:${contactEmail}">${contactEmail}</a> para solicitar una actualización prioritaria.`;
        const textEn = `Can't find one of your publications? Make sure it is registered in <a href="${concienciaURL}" target="_blank" rel="noopener">Conciencia</a>. If it's already there but still not visible here, please wait for our next update. If it's urgent, contact the IPBLN Bioinformatics Unit at <a href="mailto:${contactEmail}">${contactEmail}</a> to request an earlier update.`;

        noticeTextEl.innerHTML = (lang === 'es') ? textEs : textEn;
        noticeEl.classList.remove('d-none');
        return;
    }

    noticeEl.classList.add('d-none');
    noticeTextEl.innerHTML = '';
}
