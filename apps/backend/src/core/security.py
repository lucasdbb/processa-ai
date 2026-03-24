"""
Utilitários de segurança e anti-fraude

Funções para validação de CPF, rate limiting, reCAPTCHA e detecção de emails descartáveis.
"""

import logging
import re
from collections import defaultdict
from datetime import date, datetime
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Rate limit in-memory: {ip: [timestamps]} — substitui tabela registration_ips
_ip_registration_log: dict[str, list[datetime]] = defaultdict(list)


def validate_cpf(cpf: str) -> bool:
    """
    Valida CPF brasileiro (formato + dígitos verificadores).

    Args:
        cpf: String com CPF (pode conter pontos e traços)

    Returns:
        True se CPF é válido, False caso contrário

    Examples:
        >>> validate_cpf('123.456.789-09')
        True
        >>> validate_cpf('111.111.111-11')
        False
        >>> validate_cpf('000.000.000-00')
        False
    """
    # Remove caracteres não numéricos
    cpf = re.sub(r"[^0-9]", "", cpf)

    # Verifica se tem 11 dígitos
    if len(cpf) != 11:
        return False

    # Verifica se todos os dígitos são iguais (CPFs inválidos conhecidos)
    if cpf == cpf[0] * 11:
        return False

    # Valida os dois dígitos verificadores
    for i in range(9, 11):
        value = sum((int(cpf[num]) * ((i + 1) - num) for num in range(0, i)))
        digit = ((value * 10) % 11) % 10
        if digit != int(cpf[i]):
            return False

    return True


async def check_ip_rate_limit(supabase, ip: str, max_per_day: int = 3) -> bool:
    """
    Verifica se IP não excedeu o limite de registros por dia (in-memory).

    Args:
        supabase: Cliente Supabase (mantido por compatibilidade de assinatura)
        ip: Endereço IP a verificar
        max_per_day: Máximo de contas permitidas por IP por dia (padrão: 3)

    Returns:
        True se ainda pode registrar, False se excedeu o limite
    """
    today = date.today()
    # Limpa entradas de dias anteriores
    _ip_registration_log[ip] = [ts for ts in _ip_registration_log[ip] if ts.date() == today]
    return len(_ip_registration_log[ip]) < max_per_day


async def log_registration_ip(supabase, ip: str, user_id: str) -> None:
    """
    Registra um IP usado para criação de conta (in-memory).

    Args:
        supabase: Cliente Supabase (mantido por compatibilidade de assinatura)
        ip: Endereço IP
        user_id: UUID do usuário criado
    """
    _ip_registration_log[ip].append(datetime.now())


def is_disposable_email(email: str) -> bool:
    """
    Verifica se o email é de um provedor temporário/descartável.

    Args:
        email: Endereço de email a verificar

    Returns:
        True se é email descartável, False caso contrário

    Examples:
        >>> is_disposable_email('test@guerrillamail.com')
        True
        >>> is_disposable_email('test@gmail.com')
        False
    """
    try:
        domain = email.split("@")[1].lower()
        return domain in DISPOSABLE_DOMAINS
    except (IndexError, AttributeError):
        # Email inválido
        return False


async def verify_recaptcha(
    token: str, secret_key: str, min_score: float = 0.5
) -> tuple[bool, Optional[float]]:
    """
    Verifica token reCAPTCHA v3 com a API do Google.

    Args:
        token: Token reCAPTCHA retornado pelo frontend
        secret_key: Secret key do reCAPTCHA (da configuração)
        min_score: Score mínimo aceitável (0.0 a 1.0, padrão: 0.5)

    Returns:
        Tupla (is_valid, score) onde:
        - is_valid: True se token válido e score >= min_score
        - score: Score retornado pelo Google (0.0 a 1.0) ou None se erro

    Examples:
        >>> await verify_recaptcha(token, 'secret_key')
        (True, 0.9)
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://www.google.com/recaptcha/api/siteverify",
                data={"secret": secret_key, "response": token},
                timeout=10.0,
            )

            data = response.json()

            if not data.get("success", False):
                return (False, None)

            score = data.get("score", 0.0)
            return (score >= min_score, score)

    except Exception as e:
        # Em caso de erro na API do Google, bloquear por segurança (fail closed)
        logger.error(f"Error verifying reCAPTCHA: {e}")
        return (False, None)


async def check_blocked_entity(supabase, entity_type: str, entity_value: str) -> bool:
    """
    Verifica se uma entidade (email, IP, CPF) está bloqueada.

    Args:
        supabase: Cliente Supabase
        entity_type: Tipo da entidade ('email_domain', 'ip', 'cpf')
        entity_value: Valor a verificar

    Returns:
        True se está bloqueada, False se permitida
    """
    try:
        result = (
            supabase.table("blocked_entities")
            .select("entity_value")
            .eq("entity_type", entity_type)
            .eq("entity_value", entity_value)
            .limit(1)
            .execute()
        )

        return len(result.data) > 0

    except Exception as e:
        logger.error(f"Error checking blocked entity: {e}")
        return False


async def block_entity(
    supabase, entity_type: str, entity_value: str, reason: str, blocked_by: Optional[str] = None
) -> bool:
    """
    Adiciona uma entidade à blacklist.

    Args:
        supabase: Cliente Supabase
        entity_type: Tipo da entidade ('email_domain', 'ip', 'cpf')
        entity_value: Valor a bloquear
        reason: Motivo do bloqueio
        blocked_by: UUID do admin que bloqueou (opcional)

    Returns:
        True se bloqueou com sucesso, False se já estava bloqueado ou erro
    """
    try:
        supabase.table("blocked_entities").insert(
            {
                "entity_type": entity_type,
                "entity_value": entity_value,
                "reason": reason,
                "blocked_at": datetime.now().isoformat(),
                "blocked_by": blocked_by,
            }
        ).execute()
        return True

    except Exception as e:
        logger.error(f"Error blocking entity: {e}")
        return False


# Lista de domínios de email descartáveis/temporários
# Fonte: https://github.com/disposable/disposable-email-domains
# Esta é uma lista parcial. Para produção, considere carregar de um arquivo externo
# ou usar uma API de verificação de emails descartáveis.
DISPOSABLE_DOMAINS = {
    # Domínios mais comuns (adicionar mais conforme necessário)
    "10minutemail.com",
    "20minutemail.com",
    "30minutemail.com",
    "guerrillamail.com",
    "guerrillamailblock.com",
    "sharklasers.com",
    "grr.la",
    "guerrillamail.biz",
    "guerrillamail.de",
    "guerrillamail.net",
    "guerrillamail.org",
    "mailinator.com",
    "mailinator.net",
    "mailinator2.com",
    "tempmail.com",
    "temp-mail.org",
    "temp-mail.io",
    "throwaway.email",
    "trashmail.com",
    "trash-mail.com",
    "yopmail.com",
    "yopmail.fr",
    "yopmail.net",
    "fakeinbox.com",
    "maildrop.cc",
    "mailnesia.com",
    "mintemail.com",
    "mytrashmail.com",
    "tempinbox.com",
    "tempmailaddress.com",
    "getnada.com",
    "getairmail.com",
    "jetable.org",
    "mvrht.com",
    "mohmal.com",
    "dispostable.com",
    "emailondeck.com",
    "spamgourmet.com",
    "spambox.us",
    "tmpeml.info",
    "tmail.ws",
    "filzmail.com",
    "fakemail.fr",
    "emailfake.com",
    "emailtemporal.org",
    "correo-temporal.com",
    "correotemporal.com",
    "harakirimail.com",
    "armyspy.com",
    "cuvox.de",
    "dayrep.com",
    "einrot.com",
    "fleckens.hu",
    "rhyta.com",
    "superrito.com",
    "teleworm.us",
    "jourrapide.com",
    "dropmail.me",
    "inboxbear.com",
    "mailcatch.com",
    "mailforspam.com",
    "mailfreeonline.com",
    "mailsac.com",
    "mailtemp.net",
    "mytempemail.com",
    "sharklasers.net",
    "spam4.me",
    "tafmail.com",
    "tmail.com",
    "tmpmail.net",
    "tmpmail.org",
    "tmpnator.com",
    "wegwerfmail.de",
    "wegwerfemail.de",
    "wegwerfmail.net",
    "wegwerfmail.org",
    "zehnminutenmail.de",
    "10mail.org",
    "33mail.com",
    "anonbox.net",
    "binkmail.com",
    "boximail.com",
    "breakthru.com",
    "bsnow.net",
    "bugmenot.com",
    "centermail.com",
    "centermail.net",
    "chogmail.com",
    "choicemail1.com",
    "clrmail.com",
    "courriel.fr.nf",
    "courrieltemporaire.com",
    "cust.in",
    "despam.it",
    "disposeamail.com",
    "dodgeit.com",
    "dodgit.com",
    "dontreg.com",
    "e4ward.com",
    "emailproxsy.com",
    "emailsensei.com",
    "emailtemporanea.com",
    "emailtemporanea.net",
    "emailtemporar.ro",
    "emeil.ir",
    "emeil.in",
    "emz.net",
    "eyepaste.com",
    "fastacura.com",
    "fillmail.com",
    "fivemail.de",
    "foxtrotter.info",
    "fux0ringduh.com",
    "garliclife.com",
    "get1mail.com",
    "getonemail.com",
    "givmail.com",
    "gmal.com",
    "great-host.in",
    "greensloth.com",
    "h8s.org",
    "haltospam.com",
    "hatespam.org",
    "hidemail.de",
    "hidzz.com",
    "hotpop.com",
    "ieatspam.eu",
    "ieatspam.info",
    "imails.info",
    "inboxalias.com",
    "ipoo.org",
    "irish2me.com",
    "jetable.com",
    "jetable.fr.nf",
    "jetable.net",
    "jetable.pp.ua",
    "junk1e.com",
    "junkmail.ga",
    "kasmail.com",
    "kaspop.com",
    "keepmymail.com",
    "killmail.com",
    "killmail.net",
    "kir.ch.tc",
    "klassmaster.com",
    "klzlk.com",
    "lags.us",
    "letthemeatspam.com",
    "lhsdv.com",
    "lifebyfood.com",
    "link2mail.net",
    "litedrop.com",
    "lol.ovpn.to",
    "lookugly.com",
    "lopl.co.cc",
    "lortemail.dk",
    "lr78.com",
    "maboard.com",
    "mail-temporaire.fr",
    "mail.by",
    "mail.mezimages.net",
    "mail2rss.org",
    "mail333.com",
    "mailbidon.com",
    "mailbiz.biz",
    "mailblocks.com",
    "mailbucket.org",
    "mailcat.biz",
    "mailcatch.com",
    "mailchop.com",
    "mailde.de",
    "mailde.info",
    "maildrop.cc",
    "maildrop.cf",
    "maildrop.ga",
    "maildrop.gq",
    "maildrop.ml",
    "maildu.de",
    "maildx.com",
    "maileater.com",
    "mailed.ro",
    "mailexpire.com",
    "mailfall.com",
    "mailforspam.com",
    "mailfreeonline.com",
    "mailfree.ga",
    "mailfree.gq",
    "mailfree.ml",
    "mailguard.me",
    "mailimate.com",
    "mailin8r.com",
    "mailinatar.com",
    "mailinator.com",
    "mailinator.net",
    "mailinator.org",
    "mailinator2.com",
    "mailincubator.com",
    "mailismagic.com",
    "mailmate.com",
    "mailme.ir",
    "mailme.lv",
    "mailme24.com",
    "mailmetrash.com",
    "mailmoat.com",
    "mailms.com",
    "mailnesia.com",
    "mailnull.com",
    "mailorg.org",
    "mailpick.biz",
    "mailproxsy.com",
    "mailquack.com",
    "mailrock.biz",
    "mailscrap.com",
    "mailshell.com",
    "mailsiphon.com",
    "mailslite.com",
    "mailtemp.info",
    "mailtome.de",
    "mailtothis.com",
    "mailtrash.net",
    "mailtv.net",
    "mailtv.tv",
    "mailzilla.com",
    "makemetheking.com",
    "mbx.cc",
    "mega.zik.dj",
    "meinspamschutz.de",
    "meltmail.com",
    "messagebeamer.de",
    "mierdamail.com",
    "mintemail.com",
    "moburl.com",
    "monemail.fr.nf",
    "monmail.fr.nf",
    "msa.minsmail.com",
    "mt2009.com",
    "mt2014.com",
    "mypartyclip.de",
    "myphantomemail.com",
    "mysamp.de",
    "mytempemail.com",
    "mytrashmail.com",
    "nabuma.com",
    "neomailbox.com",
    "nepwk.com",
    "nervmich.net",
    "nervtmich.net",
    "netmails.com",
    "netmails.net",
    "netzidiot.de",
    "neverbox.com",
    "no-spam.ws",
    "nobulk.com",
    "noclickemail.com",
    "nogmailspam.info",
    "nomail.pw",
    "nomail.xl.cx",
    "nomail2me.com",
    "nomorespamemails.com",
    "nospam.ze.tc",
    "nospam4.us",
    "nospamfor.us",
    "nospammail.net",
    "notmailinator.com",
    "nowhere.org",
    "nowmymail.com",
    "nurfuerspam.de",
    "nus.edu.sg",
    "objectmail.com",
    "obobbo.com",
    "oneoffemail.com",
    "onewaymail.com",
    "online.ms",
    "opayq.com",
    "ordinaryamerican.net",
    "otherinbox.com",
    "ovpn.to",
    "owlpic.com",
    "pancakemail.com",
    "pimpedupmyspace.com",
    "pjjkp.com",
    "plexolan.de",
    "poczta.onet.pl",
    "politikerclub.de",
    "poofy.org",
    "pookmail.com",
    "privacy.net",
    "proxymail.eu",
    "prtnx.com",
    "putthisinyourspamdatabase.com",
    "quickinbox.com",
    "rcpt.at",
    "recode.me",
    "recursor.net",
    "regbypass.com",
    "regbypass.comsafe-mail.net",
    "rejectmail.com",
    "rklips.com",
    "rmqkr.net",
    "s0ny.net",
    "safe-mail.net",
    "safersignup.de",
    "safetymail.info",
    "safetypost.de",
    "sandelf.de",
    "saynotospams.com",
    "schafmail.de",
    "schrott-email.de",
    "secretemail.de",
    "secure-mail.biz",
    "secure-mail.cc",
    "selfdestructingmail.com",
    "sendspamhere.com",
    "sharklasers.com",
    "shieldemail.com",
    "shiftmail.com",
    "shitmail.me",
    "shitmail.org",
    "shitware.nl",
    "shortmail.net",
    "sibmail.com",
    "skeefmail.com",
    "slaskpost.se",
    "slopsbox.com",
    "smellfear.com",
    "snakemail.com",
    "sneakemail.com",
    "sofimail.com",
    "sofort-mail.de",
    "sogetthis.com",
    "soodonims.com",
    "spam4.me",
    "spamail.de",
    "spamarrest.com",
    "spambob.com",
    "spambob.net",
    "spambog.com",
    "spambog.de",
    "spambog.ru",
    "spambox.info",
    "spambox.irishspringrealty.com",
    "spambox.us",
    "spamcannon.com",
    "spamcannon.net",
    "spamcero.com",
    "spamcon.org",
    "spamcorptastic.com",
    "spamcowboy.com",
    "spamcowboy.net",
    "spamcowboy.org",
    "spamday.com",
    "spamex.com",
    "spamfree.eu",
    "spamfree24.com",
    "spamfree24.de",
    "spamfree24.eu",
    "spamfree24.info",
    "spamfree24.net",
    "spamfree24.org",
    "spamgoes.in",
    "spamgourmet.com",
    "spamgourmet.net",
    "spamgourmet.org",
    "spamherelots.com",
    "spamhereplease.com",
    "spamhole.com",
    "spamify.com",
    "spaminator.de",
    "spamkill.info",
    "spaml.com",
    "spaml.de",
    "spammotel.com",
    "spamobox.com",
    "spamoff.de",
    "spamslicer.com",
    "spamspot.com",
    "spamthis.co.uk",
    "spamtroll.net",
    "speed.1s.fr",
    "supergreatmail.com",
    "supermailer.jp",
    "superrito.com",
    "superstachel.de",
    "suremail.info",
    "talkinator.com",
    "teewars.org",
    "teleworm.com",
    "teleworm.us",
    "temp-mail.com",
    "temp-mail.de",
    "temp-mail.org",
    "tempail.com",
    "tempalias.com",
    "tempe-mail.com",
    "tempemail.biz",
    "tempemail.co.za",
    "tempemail.com",
    "tempemail.net",
    "tempinbox.co.uk",
    "tempinbox.com",
    "tempmail.de",
    "tempmail.eu",
    "tempmail.it",
    "tempmail2.com",
    "tempmaildemo.com",
    "tempmailer.com",
    "tempmailer.de",
    "tempomail.fr",
    "temporarily.de",
    "temporarioemail.com.br",
    "temporaryemail.net",
    "temporaryemail.us",
    "temporaryforwarding.com",
    "temporaryinbox.com",
    "temporarymailaddress.com",
    "tempsky.com",
    "thanksnospam.info",
    "thankyou2010.com",
    "thc.st",
    "thelimestones.com",
    "thisisnotmyrealemail.com",
    "thismail.net",
    "throwawayemailaddress.com",
    "throwawaymail.com",
    "tilien.com",
    "tittbit.in",
    "tizi.com",
    "tmailinator.com",
    "tmail.ws",
    "tokenmail.de",
    "toomail.biz",
    "topranklist.de",
    "tradermail.info",
    "trash-amil.com",
    "trash-mail.at",
    "trash-mail.cf",
    "trash-mail.com",
    "trash-mail.de",
    "trash-mail.ga",
    "trash-mail.gq",
    "trash-mail.ml",
    "trash-mail.tk",
    "trash2009.com",
    "trash2010.com",
    "trash2011.com",
    "trashdevil.com",
    "trashdevil.de",
    "trashemail.de",
    "trashmail.at",
    "trashmail.com",
    "trashmail.de",
    "trashmail.me",
    "trashmail.net",
    "trashmail.org",
    "trashmail.ws",
    "trashmailer.com",
    "trashymail.com",
    "trashymail.net",
    "trbvm.com",
    "trialmail.de",
    "trillianpro.com",
    "twinmail.de",
    "tyldd.com",
    "uggsrock.com",
    "upliftnow.com",
    "uplipht.com",
    "uroid.com",
    "us.af",
    "venompen.com",
    "veryrealemail.com",
    "viditag.com",
    "viralplays.com",
    "vpn.st",
    "vsimcard.com",
    "wasteland.rfc822.org",
    "webemail.me",
    "webm4il.info",
    "webuser.in",
    "wegwerf-email-addressen.de",
    "wegwerf-email-adressen.de",
    "wegwerf-email.at",
    "wegwerf-email.de",
    "wegwerf-email.net",
    "wegwerf-emails.de",
    "wegwerfadresse.de",
    "wegwerfemail.com",
    "wegwerfemail.de",
    "wegwerfemail.net",
    "wegwerfemail.org",
    "wegwerfemailadresse.com",
    "wegwerfmail.de",
    "wegwerfmail.info",
    "wegwerfmail.net",
    "wegwerfmail.org",
    "wetrainbayarea.com",
    "wetrainbayarea.org",
    "wh4f.org",
    "whyspam.me",
    "wilemail.com",
    "willselfdestruct.com",
    "winemaven.info",
    "wronghead.com",
    "wuzup.net",
    "wuzupmail.net",
    "www.e4ward.com",
    "www.mailinator.com",
    "wwwnew.eu",
    "x.ip6.li",
    "xagloo.com",
    "xemaps.com",
    "xents.com",
    "xmaily.com",
    "xoxy.net",
    "yapped.net",
    "yeah.net",
    "yep.it",
    "yogamaven.com",
    "yopmail.com",
    "yopmail.fr",
    "yopmail.net",
    "yopmail.pp.ua",
    "yuurok.com",
    "zehnminuten.de",
    "zehnminutenmail.de",
    "zippymail.info",
    "zoaxe.com",
    "zoemail.com",
    "zomg.info",
}
